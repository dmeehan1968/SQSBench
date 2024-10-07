import { ConsumerHandlerParams } from "./consumerHandlerParams.mjs"
import { Context, SQSBatchResponse } from "aws-lambda"
import { sqsRecordNormalizer } from "./sqsRecordNormalizer.mjs"
import { SqsRecordWithPayloadSchema } from "@sqsbench/schema"

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
      log.messagesReceived(records.length)

      // calculate latency before processing, or it'll be distorted by synchronous processing time
      records.map(record => log.latency(SqsRecordWithPayloadSchema.parse(record).body.sendAt ?? new Date()))

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