import { Duration } from "aws-cdk-lib"
import { Construct } from "constructs"
import { StringParameter } from "aws-cdk-lib/aws-ssm"
import { Fqn, NodejsFunction } from "@sqsbench/constructs"
import { Rule, RuleTargetInput, Schedule } from "aws-cdk-lib/aws-events"
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets"
import { z } from "zod"
import { Queue } from "aws-cdk-lib/aws-sqs"
import {
  isMinRateLteMaxRate,
  SqsProducerControllerSettings,
  SqsProducerControllerSettingsSchema,
} from "@sqsbench/schema"

export const SqsProducerPropsSchema = SqsProducerControllerSettingsSchema
  .innerType().omit({ queueUrls: true, emitterArn: true, parameterName: true })
  .extend({
    queues: z.array(z.object({
      queue: z.instanceof(Queue),
      enabled: z.boolean(),
    })),
    enabled: z.boolean().optional(),
  })
  .superRefine(isMinRateLteMaxRate)

export type SqsProducerProps = z.infer<typeof SqsProducerPropsSchema>

export class SqsProducer extends Construct {

  constructor(scope: Construct, id: string, props: SqsProducerProps) {
    super(scope, id)

    props = SqsProducerPropsSchema.parse(props)

    const param = new StringParameter(this, 'Parameter', {
      parameterName: Fqn(this),
      stringValue: JSON.stringify({ rate: 1 }),
    })

    const enabledQueues = props.queues
      .filter(q => q.enabled)
      .map(q => q.queue)

    const producer = new NodejsFunction(this, 'Default', {
      entry: import.meta.resolve('./producerHandler.mts').replace(/^file:\/\//, ''),
      timeout: Duration.minutes(1),
      bundling: { nodeModules: [ 'zod', '@middy/core' ] },
    })

    const emitter = new NodejsFunction(this, 'Emitter', {
      entry: import.meta.resolve('./emitterHandler.mts').replace(/^file:\/\//, ''),
      timeout: Duration.minutes(1),
      bundling: { nodeModules: [ 'zod', '@middy/core' ] },
    })

    emitter.grantInvoke(producer)

    param.grantRead(producer)
    param.grantWrite(producer)

    new Rule(this, 'Rule', {
      schedule: Schedule.cron({ minute: '0/1' }),
      targets: [new LambdaFunction(producer, {
        event: RuleTargetInput.fromObject(SqsProducerControllerSettingsSchema.parse({
          ...props,
          parameterName: param.parameterName,
          queueUrls: enabledQueues.map(queue => queue.queueUrl),
          emitterArn: emitter.functionArn,
        } satisfies SqsProducerControllerSettings)),
      })],
      enabled: props.enabled ?? false,
    })

    enabledQueues.forEach(queue => queue.grantSendMessages(emitter))

  }
}

