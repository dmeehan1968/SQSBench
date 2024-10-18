import { LambdaClient } from '@aws-sdk/client-lambda'
import {
  ChangeMessageVisibilityBatchCommand,
  Message,
  ReceiveMessageCommandInput,
  SQSClient,
} from '@aws-sdk/client-sqs'
import { SqsMessageProducer } from './SqsMessageProducer.mjs'
import { LambdaInvoker } from './LambdaInvoker.mjs'
import { ArrayBatcher } from './ArrayBatcher.mjs'
import { Acquired } from './types.mjs'
import { Pipeline } from './Pipeline.mjs'
import { clamp, Duration } from '@sqsbench/helpers'
import { BacklogMonitor } from './BacklogMonitor.mjs'
import { PollerProps } from '@sqsbench/schema'
import { SqsBatchItemFailureConsumer } from './SqsBatchItemFailureConsumer.mjs'
import { SqsMessagesToEventTransformer } from './SqsMessagesToEventTransformer.mjs'

export class Poller {
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
      MessageAttributeNames: ['All'],
      MessageSystemAttributeNames: ['All'],
    } satisfies ReceiveMessageCommandInput))

    // Monitor - tracks the ingest of messages to detect when backlog is cleared
    const monitor = new BacklogMonitor()

    // Return unprocessed messages to the queue
    const onBatchFinal = async (messages: Message[]) => {
      while (messages.length) {
        await this.sqs.send(new ChangeMessageVisibilityBatchCommand({
          QueueUrl: this.params.queueUrl,
          Entries: messages.splice(0, 10).map((message, index) => ({
            Id: index.toString(),
            ReceiptHandle: message.ReceiptHandle!,
            VisibilityTimeout: 0,
          }))
        }))
      }
    }

    // Batcher - groups messages into batches for the consumer
    const batcher = new ArrayBatcher<Acquired<Message[]>, Message>(
      batch => batch.data,
      this.params.batchSize,
      Duration.seconds(this.params.batchWindow),
      onBatchFinal,
    )

    // Transformer - converts SQS messages to Lambda invocation records (SQSEvent)
    const sqsRecordTransformer = new SqsMessagesToEventTransformer(this.params.queueArn)

    // Consumer - invokes the consumer Lambda function with the SQSEvent records
    const consumer = new LambdaInvoker(this.lambda, () => ({
      FunctionName: this.params.functionArn,
      InvocationType: this.params.invocationType,
    }))

    // messageDeleter - removes messages from the queue that were successfully processed
    const messageDeleter = new SqsBatchItemFailureConsumer(this.sqs, this.params.queueUrl)

    const timeout = setTimeout(() => abort.abort(), clamp(this.params.maxSessionDuration * 1000, { min: 2_000, max: 60_000 }))

    await new Pipeline(source, [monitor, batcher, sqsRecordTransformer, consumer], messageDeleter).process()

    clearTimeout(timeout)
  }
}


