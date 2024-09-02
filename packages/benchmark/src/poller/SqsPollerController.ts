import { LambdaClient } from "@aws-sdk/client-lambda"
import { Message, SQSClient } from "@aws-sdk/client-sqs"
import { Logger } from "@aws-lambda-powertools/logger"
import middy from "@middy/core"
import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware"
import { Context, SQSBatchItemFailure, SQSEvent, SQSRecord } from "aws-lambda"
import { PollerPropsSchema } from "@sqsbench/schema"
import { Function } from "./Function"
import { Queue } from "./Queue"
import { Timer } from "./Timer"
import { clamp } from "@sqsbench/helpers"
import { Batch } from "./Batch"
import pLimit from "p-limit"

export class SqsPollerController {
  constructor(
    private readonly lambda: LambdaClient,
    private readonly sqs: SQSClient,
    private readonly logger: Logger,
  ) {
  }

  get handler() {
    return middy()
      .use(injectLambdaContext(this.logger))
      .handler(this._handler.bind(this))
  }

  private async _handler(unknown: unknown, context: Context) {
    // this.logger.info('Event', { event: unknown }))
    const props = PollerPropsSchema.parse(unknown)

    const consumer = new Function(this.lambda, props.functionArn, this.logger)
    const queue = new Queue(this.sqs, props.queueUrl, this.logger)
    using sessionTimer = new Timer(clamp(props.maxSessionDuration * 1000, { max: Math.max(0, context.getRemainingTimeInMillis() - 10_000) }))
    using batchTimer = new Timer(props.batchWindow * 1000)
    const batch = new Batch<Message>(props.batchSize)
    const concurrencyController = pLimit(props.maxConcurrency)

    const invokeConsumer = async () => {
      if (batch.length === 0) {
        return
      }
      // need to take a copy of the messages from the batch, so we can clear it before the consumer gets invoked
      const messages = batch.toArray()

      // no need to await here
      void concurrencyController(() => consumer.invoke(this.transformSQSMessagesToSQSEvent(messages, props.queueArn)))
      await batch.clear()

      // await here if there are pending consumers, so we don't get ahead of ourselves with polling
      while (concurrencyController.pendingCount) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    queue
      .on('messages', async (messages) => {
        await batch.push(messages)
      })
      .on('stopped', async () => {
        await invokeConsumer()
      })

    batch.on('full', async () => {
      await invokeConsumer()
      batchTimer.start(clamp(props.batchWindow * 1000, { max: sessionTimer.timeRemainingInSeconds * 1000 }))
    })

    batchTimer.on('timeout', async () => {
      this.logger.info('Batch timeout')
      await invokeConsumer()
      batchTimer.start()
    })

    sessionTimer.on('timeout', async () => {
      this.logger.info('Session timeout')
      queue.stop()
      batchTimer.stop()
    })

    consumer.on('response', async ({ res, req }) => {
      const messages = (req as SQSEvent).Records.map(record => ({
        MessageId: record.messageId,
        ReceiptHandle: record.receiptHandle,
      }))
      if (res && Array.isArray(res.batchItemFailures)) {
        const failures = res.batchItemFailures as SQSBatchItemFailure[]
        const toDelete = messages.filter(message => !failures.some(failure => failure.itemIdentifier === message.MessageId))

        await queue.deleteMessages(toDelete)
        batchTimer.start()
      } else {
        await queue.deleteMessages(messages)
        batchTimer.start()
      }
    })

    await queue.poll(() => ({
      MaxNumberOfMessages: clamp(batch.spaceRemaining, { max: 10 }),
      WaitTimeSeconds: clamp(batchTimer.timeRemainingInSeconds, { min: 1, max: 20 }),
    }))

    await invokeConsumer()

    while (concurrencyController.pendingCount || concurrencyController.activeCount) {
      // this.logger.info(`${concurrencyController.pendingCount} pending, ${concurrencyController.activeCount} active`)
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    this.logger.info('Finished')

  }

  private transformSQSMessagesToSQSEvent(messages: Message[], queueArn: string): { Records: SQSRecord[] } {
    const decoder = new TextDecoder('utf-8')
    return {
      Records: messages.map(message => ({
        messageId: message.MessageId!,
        receiptHandle: message.ReceiptHandle!,
        body: message.Body!,
        attributes: {
          AWSTraceHeader: message.Attributes?.AWSTraceHeader!,
          ApproximateReceiveCount: message.Attributes?.ApproximateReceiveCount!,
          SentTimestamp: message.Attributes?.SentTimestamp!,
          SenderId: message.Attributes?.SenderId!,
          ApproximateFirstReceiveTimestamp: message.Attributes?.ApproximateFirstReceiveTimestamp!,
          SequenceNumber: message.Attributes?.SequenceNumber!,
          MessageGroupId: message.Attributes?.MessageGroupId!,
          MessageDeduplicationId: message.Attributes?.MessageDeduplicationId!,
          DeadLetterQueueSourceArn: message.Attributes?.DeadLetterQueueSourceArn!,
        },
        messageAttributes: Object.fromEntries(Object.entries(message.MessageAttributes ?? {}).map(([key, value]) => ([
          key,
          {
            stringValue: value.StringValue!,
            binaryValue: decoder.decode(value.BinaryValue!),
            stringListValues: value.StringListValues!,
            binaryListValues: value.BinaryListValues!.map(v => decoder.decode(v)),
            dataType: value.DataType!,
          },
        ]))),
        md5OfBody: message.MD5OfBody!,
        eventSource: 'aws:sqs',
        eventSourceARN: queueArn,
        awsRegion: process.env.AWS_REGION ?? '',
      })),
    }
  }
}