import { Transforming } from './types.mjs'
import { Message } from '@aws-sdk/client-sqs'
import { SQSEvent, SQSRecord } from 'aws-lambda'

export class SqsMessagesToEventTransformer implements Transforming<Message[], SQSEvent> {

  private source: AsyncIterable<Message[]> | undefined
  private completions = new Set<() => void>()
  private decoder = new TextDecoder('utf-8')

  constructor(private readonly queueArn: string) {
  }

  async consume(source: AsyncIterable<Message[]>): Promise<void> {
    this.source = source
    return new Promise<void>(resolve => this.completions.add(resolve))
  }

  async* generator() {
    try {
      if (!this.source) {
        throw new Error('No source')
      }

      for await (const messages of this.source) {
        yield this.transform({ Records: [] }, messages)
      }
    } finally {
      for (const completion of this.completions) {
        completion()
      }
    }
  }

  [Symbol.asyncIterator]() {
    return this.generator()
  }

  transform(_: SQSEvent, messages: Message[]): { Records: SQSRecord[] } {
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
            binaryValue: this.decoder.decode(value.BinaryValue!),
            stringListValues: value.StringListValues!,
            binaryListValues: value.BinaryListValues!.map(v => this.decoder.decode(v)),
            dataType: value.DataType!,
          },
        ]))),
        md5OfBody: message.MD5OfBody!,
        eventSource: 'aws:sqs',
        eventSourceARN: this.queueArn,
        awsRegion: process.env.AWS_REGION ?? '',
      })),
    }
  }

}