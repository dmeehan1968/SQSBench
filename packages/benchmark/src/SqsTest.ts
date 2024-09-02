import { Construct } from 'constructs'
import { Duration } from "aws-cdk-lib"
import { Queue, NodejsFunction, Fqn, LambdaCostMetric, SqsCostMetric } from "@sqsbench/constructs"
import { toExprName } from "@sqsbench/helpers"
import * as path from "node:path"
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
  maxConcurrency?: never
  maxSessionDuration?: never
}

interface EventSourceProps {
  pollerType: PollerType.EventSource
  maxConcurrency?: number
  maxSessionDuration?: never
}

interface LambdaProps {
  pollerType: PollerType.Lambda
  maxConcurrency: number
  maxSessionDuration: Duration
}

export type SqsTestProps = (PipeProps | EventSourceProps | LambdaProps) & {
  batchSize: number
  batchWindow: Duration
  enabled?: boolean
}

export class SqsTest extends Construct {
  public readonly queue: Queue
  public readonly consumer: NodejsFunction
  public readonly poller: NodejsFunction | undefined

  public readonly enabled: boolean

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

    this.consumer = new NodejsFunction(this, 'Consumer', {
      entry: path.resolve(__dirname, './consumer/index.ts'),
      timeout: Duration.seconds(10),
      deadLetterQueue: this.queue.deadLetterQueue?.queue,
      bundling: { nodeModules: [ 'zod', '@middy/core' ]},
      memorySize: 128,
    })

    switch (props.pollerType) {

      case PollerType.Pipe:
        new Pipe(this, 'Pipe', {
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
          entry: path.resolve(__dirname, './poller/handler.ts'),
          // allow up to 1 minute of polling + time for the consumer to run its final batch
          timeout: Duration.seconds(70),
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
   * Calculate the cost of the poller
   *
   * If the test is not using the poller, it will generate a 0 value
   *
   * @param period The period over which to calculate the cost - default 1 minute
   * @param label The label to use for the metric - default 'Cost'
   * @param statistic The statistic to use for the metric - default Sum
   */
  metricPollerCost({ period = Duration.minutes(1), label = 'Cost', statistic = Statistic.Sum }: { period?: Duration, label?: string, statistic?: Statistic } = {}): IMetric {

    if (!this.poller) {
      return new MathExpression({
        label: [Fqn(this, { allowedSpecialCharacters: '-' }), label].join(' '),
        expression: '0',
      })
    }

    return new LambdaCostMetric(this.poller, { period, label, statistic })
  }

  /*
   * Calculate the cost of the consumer
   *
   * If the test is not using the poller, it will generate a 0 value
   *
   * @param period The period over which to calculate the cost - default 1 minute
   * @param label The label to use for the metric - default 'Cost'
   * @param statistic The statistic to use for the metric - default Sum
   */
  metricConsumerCost({ period = Duration.minutes(1), label = 'Cost', statistic = Statistic.Sum }: { period?: Duration, label?: string, statistic?: Statistic } = {}): IMetric {

    return new LambdaCostMetric(this.consumer, { period, label, statistic })
  }

  /*
   * Calculate the cost of the entire test
   *
   * @param period The period over which to calculate the cost - default 1 minute
   * @param label The label to use for the metric - default 'Cost'
   * @param statistic The statistic to use for the metric - default Sum
   */
  metricCost({ period = Duration.minutes(1), label = 'Cost', statistic = Statistic.Sum }: { period?: Duration, label?: string, statistic?: Statistic } = {}): IMetric {
    const sqsCost = Fqn(this, { suffix: 'SqsCost', transform: toExprName })
    const pollerCost = Fqn(this, { suffix: 'PollerCost', transform: toExprName })
    return new MathExpression({
      label: [Fqn(this, { allowedSpecialCharacters: '-' }), label].join(' '),
      expression: `${sqsCost} + ${pollerCost}`,
      usingMetrics: {
        [sqsCost]: this.metricSqsCost({ period }),
        [pollerCost]: this.metricPollerCost({ period, label: 'Cost', statistic }),
      }
    })
  }

  metricConsumerBatchSize({ period = Duration.minutes(1), label = 'Batch Size', statistic = Statistic.Average }: { period?: Duration, label?: string, statistic?: Statistic } = {}): IMetric {
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