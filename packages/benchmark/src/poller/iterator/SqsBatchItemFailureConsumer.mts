import { Consuming } from './types.mjs'
import { LambdaInvocationResult, LambdaInvocationResultSchema } from './LambdaInvoker.mjs'
import { DeleteMessageBatchCommand, SQSClient } from '@aws-sdk/client-sqs'
import { z } from 'zod'
import { SQSRecordSchema } from '@sqsbench/schema'

const SqsBatchItemFailureSchema = z.object({
  itemIdentifier: z.string(),
})

const SqsBatchResponseSchema = z.object({
  batchItemFailures: SqsBatchItemFailureSchema.array(),
})

const SQSEventSchema = z.object({
  Records: SQSRecordSchema.array(),
})

const SqsBatchInvocationSchema = LambdaInvocationResultSchema.extend({
  req: SQSEventSchema,
  res: SqsBatchResponseSchema.nullable(),
})

export class SqsBatchItemFailureConsumer implements Consuming<LambdaInvocationResult> {
  constructor(
    private readonly client: SQSClient,
    private readonly queueUrl: string,
  ) {
  }

  async consume(source: AsyncIterable<LambdaInvocationResult>) {

    for await (const invocation of source) {

      const { req: event, res: batchResponse } = SqsBatchInvocationSchema.parse(invocation)

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