import { SQSRecord } from "aws-lambda"
import { z } from "zod"
import { SQSRecordSchema } from "@sqsbench/schema"

export function sqsRecordNormalizer(maybeRecords: unknown): SQSRecord[] {
  return z.union([
    SQSRecordSchema.transform(record => [record]),
    SQSRecordSchema.array(),
    z.object({ Records: SQSRecordSchema.array() }).transform(({ Records }) => Records),
  ]).parse(maybeRecords)
}