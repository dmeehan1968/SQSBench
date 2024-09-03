import { JsonSchema } from "./JsonSchema.mjs"
import { SqsConsumerPayloadSchema } from "./SqsConsumerPayloadSchema.mjs"
import { SQSRecordSchema } from "./SQSRecordSchema.mjs"

export const SqsRecordWithPayloadSchema = SQSRecordSchema.extend({
  body: JsonSchema.pipe(SqsConsumerPayloadSchema),
})