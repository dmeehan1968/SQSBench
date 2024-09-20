import { ConsumerHandlerParams } from "./consumerHandlerParams.mjs"
import { Context, Handler, SQSBatchResponse } from "aws-lambda"
import { sqsRecordNormalizer } from "./sqsRecordNormalizer.mjs"
import { SqsRecordWithPayloadSchema } from "@sqsbench/schema"

export function createHandler({
  getLogger,
  processBatchItems,
  processRecord,
}: ConsumerHandlerParams): Handler<unknown, SQSBatchResponse> {

  return async (event: unknown, context: Context) => {

    using log = getLogger()

    log.context(context)

    try {
      const records = sqsRecordNormalizer(event)

      log.messagesReceived(records.length)

      return processBatchItems(records, record => {
        return processRecord(SqsRecordWithPayloadSchema.parse(record).body)
      })

    } catch (error) {
      log.error(error)
      throw new Error('Failed to process batch', { cause: error })
    }
  }
}