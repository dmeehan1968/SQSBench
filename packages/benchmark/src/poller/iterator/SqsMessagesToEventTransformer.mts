import { Transforming } from './types.mjs'
import { Message } from '@aws-sdk/client-sqs'
import { SQSEvent } from 'aws-lambda'
import { MultiSourceConsumer } from './MultiSourceConsumer.mjs'

export class SqsMessagesToEventTransformer implements Transforming<Message[], SQSEvent> {

  private multiSourceConsumer: MultiSourceConsumer<Message[], SQSEvent>
  private decoder = new TextDecoder('utf-8')

  constructor(private readonly queueArn: string) {
    this.multiSourceConsumer = new MultiSourceConsumer(messages => this.transform(messages))
  }

  async consume(source: AsyncIterable<Message[]>): Promise<void> {
    return this.multiSourceConsumer.consume(source)
  }

  [Symbol.asyncIterator]() {
    return this.multiSourceConsumer.generator()
  }

  async transform(messages: Message[]): Promise<SQSEvent> {
    return {
      Records: messages.map(message => ({
        messageId: message.MessageId!,
        receiptHandle: message.ReceiptHandle!,
        body: message.Body!,
        attributes: {
          AWSTraceHeader: message.Attributes?.AWSTraceHeader!,
          ApproximateReceiveCount: message.Attributes?.ApproximateReceiveCount ?? '1',
          SentTimestamp: message.Attributes?.SentTimestamp ?? Date.now().toString(),
          SenderId: message.Attributes?.SenderId ?? 'sender',
          ApproximateFirstReceiveTimestamp: message.Attributes?.ApproximateFirstReceiveTimestamp ?? Date.now().toString(),
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