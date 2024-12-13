import { z } from 'zod'
import { SQSRecordNormaliserSchema } from '@sqsbench/schema'
import { DeleteMessageBatchCommand, SQSClient } from '@aws-sdk/client-sqs'
import { SQSRecord } from 'aws-lambda'
import { chunkArray } from '@sqsbench/helpers'
import pLimit from 'p-limit-esm'
import { Logger } from '@aws-lambda-powertools/logger'

const LambdaCompletionEvent = z.object({
  version: z.string(),
  timestamp: z.coerce.date(),
  requestContext: z.object({
    requestId: z.string(),
    functionArn: z.string(),
    condition: z.string(),
    approximateInvokeCount: z.number(),
  }),
  requestPayload: z.unknown().optional(),
  responseContext: z.object({
    statusCode: z.number(),
    functionError: z.string().optional(),
    error: z.any().optional(),
  }),
  responsePayload: z.unknown().optional()
})

const SQSBatchItemFailureSchema = z.object({
  itemIdentifier: z.string(),
})

const SQSBatchResponseSchema = z.object({
  batchItemFailures: SQSBatchItemFailureSchema.array()
})

const SQSLambdaCompletionEvent = LambdaCompletionEvent.extend({
  requestPayload: SQSRecordNormaliserSchema,
  responsePayload: SQSBatchResponseSchema,
})

const sqsClient = new SQSClient()
const logger = new Logger()

export const handler = async (unknown: unknown) => {

  logger.info('Event', { event: unknown })

  const event = SQSLambdaCompletionEvent.parse(unknown)

  if (event.responseContext.functionError) {
    // we create return early as all messages will be left in the queue
    return
  }

  const messageIds = new Map(event.requestPayload.map(record => ([record.messageId, record])))

  // some failed, so remove the failures from the list
  event.responsePayload.batchItemFailures.forEach(failure => {
    messageIds.delete(failure.itemIdentifier)
  })

  // no messages left, so return early
  if (messageIds.size === 0) {
    return
  }

  // split the message ids by event source arn
  const messagesByQueue = new Map<string, SQSRecord[]>()
  for (const [ , record] of messageIds) {
    const { eventSourceARN } = record
    if (!messagesByQueue.has(eventSourceARN)) {
      messagesByQueue.set(eventSourceARN, [])
    }
    messagesByQueue.get(eventSourceARN)!.push(record)
  }

  // deletions can be done in parallel, up to the SQS client connections limit
  const limit = pLimit(50)

  // create a delete batch command for each queue, max 10 messages per command
  const pending = await Promise.all(
    Array.from(messagesByQueue.entries()).flatMap(([queueArn, messages]) => {

      const queueUrl = queueUrlFromArn(queueArn)

      return chunkArray(messages, 10).map(chunk => limit(() => {
        logger.debug(`Deleting ${chunk.length} messages from ${queueUrl}`)

        const command = new DeleteMessageBatchCommand({
          QueueUrl: queueUrl,
          Entries: chunk.map(message => ({
            Id: message.messageId,
            ReceiptHandle: message.receiptHandle
          }))
        })

        return sqsClient.send(command)
      }))
    })
  )

  await Promise.allSettled(pending)

}

function queueUrlFromArn(queueArn: string) {
  const arnMatch = queueArn.match(/^arn:aws:sqs:(?<region>[^:]+):(?<accountId>[^:]+):(?<queueName>.+)$/)
  if (!arnMatch) {
    throw new Error(`Invalid ARN: ${queueArn}`)
  }
  const { region, accountId, queueName } = arnMatch.groups!
  return `https://sqs.${region}.amazonaws.com/${accountId}/${queueName}`
}