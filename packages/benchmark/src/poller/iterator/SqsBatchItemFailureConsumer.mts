import { Consuming } from './types.mjs'
import { LambdaInvocationResult } from './LambdaInvoker.mjs'
import { DeleteMessageBatchCommand, SQSClient } from '@aws-sdk/client-sqs'
import { SQSBatchResponse, SQSEvent } from 'aws-lambda'

export class SqsBatchItemFailureConsumer implements Consuming<LambdaInvocationResult<SQSEvent, SQSBatchResponse>> {
  constructor(
    private readonly client: SQSClient,
    private readonly queueUrl: string,
  ) {
  }

  async consume(source: AsyncIterable<LambdaInvocationResult<SQSEvent, SQSBatchResponse>>) {
    for await (const { req: event, res: batchResponse } of source) {
      const failures = new Map<string, undefined>()
      batchResponse && batchResponse.batchItemFailures.forEach(item => failures.set(item.itemIdentifier, undefined))
      const toDelete = event.Records
        .filter(msg => msg.messageId && msg.receiptHandle && !failures.has(msg.messageId))
        .map((msg, index) => ({
          Id: index.toString(),
          ReceiptHandle: msg.receiptHandle,
        }))

      if (toDelete.length) {
        await this.client.send(new DeleteMessageBatchCommand({
          QueueUrl: this.queueUrl,
          Entries: toDelete,
        }))
      }
    }
  }
}