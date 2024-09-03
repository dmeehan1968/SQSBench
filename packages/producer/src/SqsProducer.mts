import { Duration } from "aws-cdk-lib"
import { Construct } from "constructs"
import { StringParameter } from "aws-cdk-lib/aws-ssm"
import { Fqn, NodejsFunction, Queue } from "@sqsbench/constructs"
import { Rule, RuleTargetInput, Schedule } from "aws-cdk-lib/aws-events"
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets"
import { SqsProducerSettings } from "@sqsbench/schema"

interface Props {
  queues: { queue: Queue, enabled: boolean }[],
  enabled?: boolean
  dutyCycle?: number
  minRate: number
  maxRate: number
}

export class SqsProducer extends Construct {

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id)

    const param = new StringParameter(this, 'Parameter', {
      parameterName: Fqn(this),
      stringValue: JSON.stringify({ rate: 1 }),
    })

    const enabledQueues = props.queues.filter(q => q.enabled)

    const producer = new NodejsFunction(this, 'Default', {
      entry: import.meta.resolve('./handler.mts').replace(/^file:\/\//, ''),
      timeout: Duration.minutes(1),
      bundling: { nodeModules: [ 'zod', '@middy/core' ] },
    })

    producer.grantInvokeSelf()

    param.grantRead(producer)
    param.grantWrite(producer)

    new Rule(this, 'Rule', {
      schedule: Schedule.cron({ minute: '0/1' }),
      targets: [new LambdaFunction(producer, {
        event: RuleTargetInput.fromObject({
          minRate: props.minRate,
          maxRate: props.maxRate,
          dutyCycle: props.dutyCycle ?? 0.75,
          parameterName: param.parameterName,
          queueUrls: enabledQueues.map(q => q.queue.queueUrl),
        } satisfies SqsProducerSettings),
      })],
      enabled: props.enabled ?? false,
    })

    enabledQueues.forEach(queue => queue.queue.grantSendMessages(producer))

  }
}