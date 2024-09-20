import { ConsumerLogger } from "./consumerLogger.mjs"
import { ProcessBatchItems } from "./processBatchItems.mjs"
import { Record } from "./record.mjs"

export interface ConsumerHandlerParams {
  getLogger: () => ConsumerLogger
  processBatchItems: ProcessBatchItems
  processRecord: (record: Record) => Promise<void>
}