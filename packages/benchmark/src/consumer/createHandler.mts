import { ConsumerHandlerParams } from "./consumerHandlerParams.mjs"
import { Context, SQSBatchResponse } from "aws-lambda"
import { sqsRecordNormalizer } from "./sqsRecordNormalizer.mjs"
import { SqsRecordWithPayloadSchema } from "@sqsbench/schema"
import { chunkArray } from '@sqsbench/helpers'

export function createHandler({
  log,
  processBatchItems,
  processRecord,
}: ConsumerHandlerParams): (event: unknown, context: Context) => Promise<SQSBatchResponse> {

  return async (event: unknown, context: Context) => {

    log.context(context)

    try {
      const records = sqsRecordNormalizer(event)

      log.perMessageDuration()
      log.highResMetrics()

      // calculate latency before processing, or it'll be distorted by synchronous processing time
      let metrics = 0

      chunkArray(
        records
          .map(record => SqsRecordWithPayloadSchema.parse(record).body.sendAt ?? new Date())
          .sort((a, b) => b.getTime() - a.getTime()),
        50)
        .forEach(records => {
          records.forEach(sentAt => {
            log.latency(sentAt)
            if (++metrics >= 50) {
              log.flushMetrics()
              metrics = 0
            }
          })
        })

      log.messagesReceived(records.length)  // log here to ensure we have at least one metric in the final batch

      return await processBatchItems(records, record => {
        const payload = SqsRecordWithPayloadSchema.parse(record).body
        return processRecord(payload)
      })

    } catch (error) {
      log.error(error)
      throw new Error('Failed to process batch', { cause: error })
    }
  }
}