import { z } from "zod"
import { SQSRecordSchema } from "./SQSRecordSchema.mjs"

export const SQSRecordNormaliserSchema = z.union([
  SQSRecordSchema.transform(record => [record]),
  SQSRecordSchema.array(),
  z.object({ Records: SQSRecordSchema.array() }).transform(({ Records }) => Records),
])