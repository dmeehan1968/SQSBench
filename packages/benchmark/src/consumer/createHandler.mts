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

      return await processBatchItems(records, record => {
        return processRecord(SqsRecordWithPayloadSchema.parse(record).body)
      })

    } catch (error) {
      log.error(error)
      throw new Error('Failed to process batch', { cause: error })
    }
  }
}