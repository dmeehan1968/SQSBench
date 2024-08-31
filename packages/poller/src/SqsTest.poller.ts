import { Context, SQSBatchItemFailure, SQSEvent, SQSRecord } from "aws-lambda"
import { Message } from "@aws-sdk/client-sqs"
import { z } from "zod"
import pLimit from "p-limit"
import { Batch, clamp, Function, Timer, Queue } from "@sqsbench/poller"

const PollerPropsSchema = z.object({
  queueUrl: z.string(),
  queueArn: z.string(),
  functionArn: z.string(),
  batchSize: z.number(),
  batchWindow: z.number(),
  maxSessionDuration: z.number(),
  maxConcurrency: z.number(),
})

export type PollerProps = z.infer<typeof PollerPropsSchema>

export const handler = async (unknown: unknown, context: Context) => {

  // console.log('Event', JSON.stringify(unknown, null, 2))
  const props = PollerPropsSchema.parse(unknown)

  const consumer = new Function(props.functionArn)
  const queue = new Queue(props.queueUrl)
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
    void concurrencyController(() => consumer.invoke(transformSQSMessagesToSQSEvent(messages, props.queueArn)))
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
    console.log('Batch timeout')
    await invokeConsumer()
    batchTimer.start()
  })

  sessionTimer.on('timeout', async () => {
    console.log('Session timeout')
    queue.stop()
    batchTimer.stop()
  })

  consumer.on('response', async ({ res, req }) => {
    const messages = (req as SQSEvent).Records.map(record => ({ MessageId: record.messageId, ReceiptHandle: record.receiptHandle }))
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
    // console.log(`${concurrencyController.pendingCount} pending, ${concurrencyController.activeCount} active`)
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  console.log('Finished')
}

function transformSQSMessagesToSQSEvent(messages: Message[], queueArn: string): { Records: SQSRecord[] } {
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
        }
      ]))),
      md5OfBody: message.MD5OfBody!,
      eventSource: 'aws:sqs',
      eventSourceARN: queueArn,
      awsRegion: process.env.AWS_REGION ?? '',
    })),
  }
}