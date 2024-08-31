import { Duration, Stack } from "aws-cdk-lib"
import { Construct } from "constructs"
import { StringParameter } from "aws-cdk-lib/aws-ssm"
import { Fqn } from "@sqsbench/helpers"
import { NodejsFunction } from "@sqsbench/helpers"
import { Rule, RuleTargetInput, Schedule } from "aws-cdk-lib/aws-events"
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets"
import { Queue } from "@sqsbench/helpers"
import * as path from "node:path"
import { Policy, PolicyStatement } from "aws-cdk-lib/aws-iam"
import { SqsProducerSettings } from "@sqsbench/schema"

interface Props {
  queues: { queue: Queue, enabled: boolean }[],
  enabled?: boolean
  dutyCycle?: number
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
      entry: path.resolve(__dirname, './SqsTest.producer.ts'),
      timeout: Duration.minutes(1),
      bundling: { nodeModules: [ 'zod' ]},
    })

    // Allow the producer to invoke itself (can't use grantInvoke here due to circular dependency)
    const policy = new Policy(this, 'Policy', {
      statements: [
        new PolicyStatement({
          actions: ['lambda:InvokeFunction'],
          resources: [producer.functionArn],
        })
      ]
    })
    policy.attachToRole(producer.role!)

    param.grantRead(producer)
    param.grantWrite(producer)

    new Rule(this, 'Rule', {
      schedule: Schedule.cron({ minute: '0/1' }),
      targets: [new LambdaFunction(producer, {
        event: RuleTargetInput.fromObject({
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