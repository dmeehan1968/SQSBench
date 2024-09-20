import { ConsumerLogger } from "./consumerLogger.mjs"
import { ProcessBatchItems } from "./processBatchItems.mjs"
import { Record } from "./record.mjs"

export interface ConsumerHandlerParams {
  log: ConsumerLogger
  processBatchItems: ProcessBatchItems
  processRecord: (record: Record) => Promise<void>
}