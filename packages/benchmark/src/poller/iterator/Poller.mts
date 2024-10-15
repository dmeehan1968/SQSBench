import { LambdaClient } from '@aws-sdk/client-lambda'
import { Message, SQSClient } from '@aws-sdk/client-sqs'
import { SqsMessageProducer } from './SqsMessageProducer.mjs'
import { LambdaInvoker } from './LambdaInvoker.mjs'
import { ArrayBatcher } from './ArrayBatcher.mjs'
import { Acquired } from './types.mjs'
import { Pipeline } from './Pipeline.mjs'
import { clamp, Duration } from '@sqsbench/helpers'
import { BacklogMonitor } from './BacklogMonitor.mjs'
import { PollerProps, PollerPropsSchema } from '@sqsbench/schema'
import { SqsBatchItemFailureConsumer } from './SqsBatchItemFailureConsumer.mjs'
import { SqsMessagesToEventTransformer } from './SqsMessagesToEventTransformer.mjs'

const sqs = new SQSClient()
const lambda = new LambdaClient()

class Poller {
  constructor(
    private readonly lambda: LambdaClient,
    private readonly sqs: SQSClient,
    private readonly params: PollerProps,
  ) {
  }

  async poll() {
    const abort = new AbortController()

    // Source - polls for SQS messages
    const source = new SqsMessageProducer(this.sqs, abort.signal, () => ({
      QueueUrl: this.params.queueUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 1,
    }))

    // Monitor - tracks the ingest of messages to detect when backlog is cleared
    const monitor = new BacklogMonitor()

    // Batcher - groups messages into batches for the consumer
    const batcher = new ArrayBatcher<Acquired<Message[]>, Message>(
      (acc, cur) => [...acc, ...cur.data],
      this.params.batchSize,
      Duration.seconds(this.params.batchWindow),
    )

    // Transformer - converts SQS messages to Lambda invocation records (SQSEvent)
    const sqsRecordTransformer = new SqsMessagesToEventTransformer(this.params.queueArn)

    // Consumer - invokes the Lambda function with the SQSEvent records
    const consumer = new LambdaInvoker(this.lambda, () => ({
      FunctionName: this.params.functionArn,
      InvocationType: this.params.invocationType,
    }))

    // Deleter - removes messages from the queue that were successfully processed
    const deleter = new SqsBatchItemFailureConsumer(this.sqs, this.params.queueUrl)

    setTimeout(() => abort.abort(), clamp(this.params.maxSessionDuration * 1000, { min: 2_000, max: 60_000 }))

    await new Pipeline(source, [monitor, batcher, sqsRecordTransformer, consumer], deleter).process()

  }
}

export const handler = async (unknown: unknown) => {
  const params = PollerPropsSchema.parse(unknown)

  await new Poller(lambda, sqs, params)
    .poll()
}


