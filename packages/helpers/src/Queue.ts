import { aws_sqs as sqs, Duration } from "aws-cdk-lib"
import { Construct } from "constructs"
import { deepmerge } from "deepmerge-ts"
import { Fqn } from "@sqsbench/helpers"
import { DeadLetterQueue, IQueue } from "aws-cdk-lib/aws-sqs"

export interface QueueProps extends Omit<sqs.QueueProps, 'deadLetterQueue'> {
  deadLetterQueue?: Omit<DeadLetterQueue, 'queue'> & {
    queue?: IQueue | sqs.QueueProps
  }
}

export class Queue extends sqs.Queue {
  constructor(scope: Construct, id: string, props?: QueueProps) {

    const { deadLetterQueue, ...rest } = props ?? {}

    let dlq: sqs.Queue | undefined = undefined

    if (deadLetterQueue) {
      dlq = deadLetterQueue.queue instanceof sqs.Queue
        ? deadLetterQueue.queue
        : new sqs.Queue(scope, `${id === 'Default' ? '' : id}DLQ`, deepmerge({
          queueName: Fqn(scope, { suffix: `${id === 'Default' ? '' : id}DLQ`, allowedSpecialCharacters: '-_' }),
          retentionPeriod: Duration.days(14),
          redriveAllowPolicy: { redrivePermission: sqs.RedrivePermission.ALLOW_ALL },
        } satisfies sqs.QueueProps, deadLetterQueue.queue))
    }

    super(scope, id, deepmerge({
      queueName: Fqn(scope, { suffix: id === 'Default' ? undefined : id }),
      retentionPeriod: Duration.days(14),
      receiveMessageWaitTime: Duration.seconds(20),
      ...(dlq && {
        deadLetterQueue: {
          queue: dlq,
          maxReceiveCount: deadLetterQueue?.maxReceiveCount ?? 3,
        },
      })
    } satisfies sqs.QueueProps, rest))

  }
}