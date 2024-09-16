import { Construct } from 'constructs'
import { Duration } from "aws-cdk-lib"
import { Fqn, LambdaCostMetric, NodejsFunction, PipeCostMetric, Queue, SqsCostMetric } from "@sqsbench/constructs"
import { toExprName } from "@sqsbench/helpers"
import { Rule, RuleTargetInput, Schedule } from "aws-cdk-lib/aws-events"
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets"
import { Statistic } from "@aws-sdk/client-cloudwatch"
import { IMetric, MathExpression, Metric } from "aws-cdk-lib/aws-cloudwatch"
import { DesiredState, Pipe } from "@aws-cdk/aws-pipes-alpha"
import { SqsSource } from "@aws-cdk/aws-pipes-sources-alpha"
import { LambdaFunction as LambdaPipeTarget } from "@aws-cdk/aws-pipes-targets-alpha"
import { PollerProps } from "@sqsbench/schema"

export enum PollerType {
  Pipe = 'Pipe',
  EventSource = 'EventSource',
  Lambda = 'Lambda',
}

interface PipeProps {
  pollerType: PollerType.Pipe

  /**
   * Enable high resolution metrics.  Also requires the batch window to be 0 or it will only generate standard metrics
   *
   * WARNING: You only need to enable this on one Pipe test in the dashboard or more metrics will be generated
   * than needed
   */
  highResMetrics?: boolean
  maxConcurrency?: never
  maxSessionDuration?: never
}

interface EventSourceProps {
  pollerType: PollerType.EventSource
  /**
   * Maximum event source concurrency
   */
  maxConcurrency?: number
  maxSessionDuration?: never
}

interface LambdaProps {
  pollerType: PollerType.Lambda

  /**
   * Maximum number of concurrent consumers
   */
  maxConcurrency: number
  /**
   * Maximum period that the poller can attempt to read messages.  Will automatically stop reading on first empty
   * receive, but will continue to poll for messages until the max session duration is reached if the poll response(s)
   * are not empty.
   */
  maxSessionDuration: Duration
}

export type SqsTestProps = (PipeProps | EventSourceProps | LambdaProps) & {
  batchSize: number
  batchWindow: Duration
  enabled?: boolean
  perMessageDuration?: Duration
}

export class SqsTest extends Construct {
  public readonly queue: Queue
  public readonly consumer: NodejsFunction
  public readonly poller: NodejsFunction | undefined
  public readonly pipe: Pipe | undefined
  public readonly enabled: boolean
  public readonly supportsHighRes: boolean
  public readonly highResMetricsEnabled: boolean

  constructor(scope: Construct, props: SqsTestProps) {

    const id = `Test-${props.pollerType}-B${props.batchSize}-W${props.batchWindow.toSeconds()}` + (props.maxConcurrency !== undefined ? `-C${props.maxConcurrency}` : '')

    super(scope, id)

    this.enabled = props.enabled ?? false

    // Visibility timeout should be 6 times the batch window (or use the default)
    const visibilityTimeout = props.batchWindow && props.batchWindow.toSeconds() > 0 ? Duration.seconds(props.batchWindow.toSeconds() * 6) : undefined

    this.queue = new Queue(this, 'Default', {
      visibilityTimeout,
      // deadLetterQueue: { maxReceiveCount: 3 },
    })

    const perMessageDuration = props.perMessageDuration ?? Duration.millis(50)
    const timeout = Duration.seconds(Math.ceil((perMessageDuration.toMilliseconds() * props.batchSize) / 1000) + 3)
    if (timeout.toSeconds() > 900) {
      throw new Error('Per Message Duration * Batch Size cannot exceed 897 seconds')
    }

    this.supportsHighRes = props.pollerType === PollerType.Pipe && props.batchWindow.toSeconds() === 0
    this.highResMetricsEnabled = props.pollerType === PollerType.Pipe && props.batchWindow.toSeconds() === 0 && (props.highResMetrics ?? false)

    this.consumer = new NodejsFunction(this, 'Consumer', {
      entry: import.meta.resolve('./consumer/handler.mts').replace(/^file:\/\//, ''),
      deadLetterQueue: this.queue.deadLetterQueue?.queue,
      bundling: { nodeModules: [ 'zod', '@middy/core' ]},
      memorySize: 128,
      environment: {
        PER_MESSAGE_DURATION: perMessageDuration.toIsoString(),
        HIGH_RES_METRICS: this.supportsHighRes && (props.pollerType === PollerType.Pipe && (props.highResMetrics ?? false)) ? 'true' : 'false',
      },
      timeout,
    })

    switch (props.pollerType) {

      case PollerType.Pipe:
        this.pipe = new Pipe(this, 'Pipe', {
          pipeName: Fqn(this, { allowedSpecialCharacters: '-' }),
          source: new SqsSource(this.queue, {
            batchSize: props.batchSize,
            maximumBatchingWindow: props.batchWindow,
          }),
          target: new LambdaPipeTarget(this.consumer, {}),
          desiredState: props.enabled ? DesiredState.RUNNING : DesiredState.STOPPED,
        })
        break

      case PollerType.EventSource:
        this.queue.grantConsumeMessages(this.consumer)
        this.consumer.addEventSourceMapping('Mapping', {
          eventSourceArn: this.queue.queueArn,
          batchSize: props.batchSize,
          maxBatchingWindow: props.batchWindow,
          reportBatchItemFailures: true,
          maxConcurrency: props.maxConcurrency,
          enabled: props.enabled ?? false,
        })
        break

      case PollerType.Lambda: {
        this.poller = new NodejsFunction(this, 'Poller', {
          entry: import.meta.resolve('./poller/handler.mts').replace(/^file:\/\//, ''),
          // allow polling time + time for the consumer to run its final batch
          timeout: props.maxSessionDuration.plus(Duration.seconds(Math.ceil(((50 * props.batchSize) + 3000) / 1000))),
          bundling: { nodeModules: [ 'zod' ]},
          memorySize: 128,
        })

        this.queue.grantConsumeMessages(this.poller)
        this.consumer.grantInvoke(this.poller)

        new Rule(this, 'Rule', {
          ruleName: Fqn(this, { allowedSpecialCharacters: '-', suffix: 'Poller' }),
          schedule: Schedule.cron({ minute: '0/1' }),
          targets: [ new LambdaFunction(this.poller, {
            event: RuleTargetInput.fromObject({
              queueUrl: this.queue.queueUrl,
              queueArn: this.queue.queueArn,
              functionArn: this.consumer.functionArn,
              batchSize: props.batchSize,
              batchWindow: props.batchWindow.toSeconds(),
              maxSessionDuration: props.maxSessionDuration.toSeconds(),
              maxConcurrency: props.maxConcurrency,
            } satisfies PollerProps)
          }) ],
          enabled: props.enabled ?? false,
        })

        break
      }

      default:
        throw new Error('Invalid poller type')
    }

  }

  /*
   * Calculate the cost of the poller type
   *
   * EventSource Mapping doesn't seem to have a cost other than the invoked lambda, which is the consumer and
   * costed separately
   *
   * @param period The period over which to calculate the cost - default 1 minute
   * @param label The label to use for the metric - default 'Cost'
   * @param statistic The statistic to use for the metric - default Sum
   */
  metricPollingCost({ period = Duration.minutes(1), label = 'Cost', statistic = Statistic.Sum }: { period?: Duration, label?: string, statistic?: Statistic } = {}): IMetric {

    if (this.pipe) {
      return new PipeCostMetric(this.pipe, { period, label, statistic })
    }

    if (this.poller) {
      return new LambdaCostMetric(this.poller, { period, label, statistic })
    }

    // return a placeholder
    return new Metric({
      metricName: [Fqn(this, { allowedSpecialCharacters: '-' }), label].join(' '),
      namespace: 'PlaceholderNamespace',
      dimensionsMap: {},
      period,
      statistic: Statistic.Sum,
    })
  }

  /*
   * Calculate the cost of the consumer
   *
   * @param period The period over which to calculate the cost - default 1 minute
   * @param label The label to use for the metric - default 'Cost'
   * @param statistic The statistic to use for the metric - default Sum
   */
  metricConsumerCost({ period = Duration.minutes(1), label = 'Cost', statistic = Statistic.Sum }: { period?: Duration, label?: string, statistic?: Statistic } = {}): IMetric {
    return new LambdaCostMetric(this.consumer, { period, label, statistic })
  }

  /*
   * Calculate the cost of the entire test (SQS, polling type and consumer)
   *
   * @param period The period over which to calculate the cost - default 1 minute
   * @param label The label to use for the metric - default 'Cost'
   * @param statistic The statistic to use for the metric - default Sum
   */
  metricTotalCost({ period = Duration.minutes(1), label = 'Cost', statistic = Statistic.Sum }: { period?: Duration, label?: string, statistic?: Statistic } = {}): IMetric {
    const sqsCost = Fqn(this, { suffix: 'SqsCost', transform: toExprName })
    const pollingCost = Fqn(this, { suffix: 'PollingCost', transform: toExprName })
    const consumerCost = Fqn(this, { suffix: 'ConsumerCost', transform: toExprName })
    return new MathExpression({
      label: [Fqn(this, { allowedSpecialCharacters: '-' }), label].join(' '),
      expression: `${sqsCost} + ${pollingCost} + ${consumerCost}`,
      usingMetrics: {
        [sqsCost]: this.metricSqsCost({ period, label: 'SQS Cost' }),
        [pollingCost]: this.metricPollingCost({ period, label: 'Polling Cost', statistic }),
        [consumerCost]: this.metricConsumerCost({ period, label: 'Consumer Cost', statistic }),
      }
    })
  }

  metricConsumerMessagesReceived({ period = Duration.minutes(1), label = 'Messages Received', statistic = Statistic.Average }: { period?: Duration, label?: string, statistic?: Statistic } = {}): IMetric {
    return new Metric({
      label: [Fqn(this, { allowedSpecialCharacters: '-' }), label].join(' '),
      namespace: this.consumer.metricsNamespace,
      metricName: 'MessagesReceived',
      dimensionsMap: {
        service: this.consumer.functionName,
      },
      statistic,
      period,
    })
  }

  metricSqsCost({ period = Duration.minutes(1), label = 'SQS Cost' }: { period?: Duration, label?: string } = {}): IMetric {
    return new SqsCostMetric(this.queue, { period, label })
  }

}

