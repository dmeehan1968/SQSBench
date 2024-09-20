import { SQSBatchItemFailure, SQSBatchResponse, SQSRecord } from "aws-lambda"

export interface ProcessBatchItems {
  (records: SQSRecord[], handler: (record: SQSRecord) => Promise<any>): Promise<SQSBatchResponse>
}

export const processBatchItems = async (records: SQSRecord[], handler: (record: SQSRecord) => Promise<any>): Promise<SQSBatchResponse> => {
  const results = await Promise.allSettled(records.map(record => handler(record)))
  return {
    batchItemFailures: records
      .map((record, index) => results[index]?.status !== 'fulfilled' ? { itemIdentifier: record.messageId } : undefined)
      .filter((id): id is SQSBatchItemFailure => !!id),
  }
}