import { z } from 'zod'
import { SQSRecordNormaliserSchema } from '@sqsbench/schema'
import { DeleteMessageBatchCommand, SQSClient } from '@aws-sdk/client-sqs'
import { SQSRecord } from 'aws-lambda'
import { chunkArray } from '@sqsbench/helpers'
import pLimit from 'p-limit-esm'
import { Logger } from '@aws-lambda-powertools/logger'

const completionSchema = z.object({
  version: z.string(),
  timestamp: z.coerce.date(),
  requestContext: z.object({
    requestId: z.string(),
    functionArn: z.string(),
    condition: z.string(),
    approximateInvokeCount: z.number(),
  }),
  requestPayload: SQSRecordNormaliserSchema,
  responseContext: z.object({
    statusCode: z.number(),
    functionError: z.string().optional(),
    error: z.any().optional(),
  }),
  responsePayload: z.object({
    batchItemFailures: z.object({
      itemIdentifier: z.string(),
    }).array()
  }).optional()
})

const sqsClient = new SQSClient()
const logger = new Logger()

export const handler = async (unknown: unknown) => {

  logger.info('Event', { event: unknown })

  const event = completionSchema.parse(unknown)
  const messageIds = new Map(event.requestPayload.map(record => ([record.messageId, record])))

  if (event.responseContext.functionError) {
    // all failed, so delete nothing from the queue so they get retried
    messageIds.clear()
  } else if (event.responsePayload?.batchItemFailures?.length) {
    // some failed, so remove the failures from the list
    for (const failure of event.responsePayload.batchItemFailures) {
      messageIds.delete(failure.itemIdentifier)
    }
  }

  if (messageIds.size) {
    // split the message ids by event source arn
    const messagesByQueue = new Map<string, SQSRecord[]>()
    for (const [ , record] of messageIds) {

      if (!messagesByQueue.has(record.eventSourceARN)) {
        messagesByQueue.set(record.eventSourceARN, [])
      }
      messagesByQueue.get(record.eventSourceARN)!.push(record)
    }

    // deletions can be done in parallel, up to the SQS client connections limit
    const limit = pLimit(50)

    // create a delete batch command for each queue, max 10 messages per command
    const pending = await Promise.all(
      Array.from(messagesByQueue.entries()).flatMap(([queueArn, messages]) => {
        return chunkArray(messages, 10).map(chunk => limit(() => {

          const arnMatch = queueArn.match(/^arn:aws:sqs:(?<region>[^:]+):(?<accountId>[^:]+):(?<queueName>.+)$/)
          if (!arnMatch) {
            throw new Error(`Invalid ARN: ${queueArn}`)
          }
          const { region, accountId, queueName } = arnMatch.groups!
          const queueUrl = `https://sqs.${region}.amazonaws.com/${accountId}/${queueName}`

          logger.info(`Deleting ${chunk.length} messages from ${queueUrl}`)

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

}