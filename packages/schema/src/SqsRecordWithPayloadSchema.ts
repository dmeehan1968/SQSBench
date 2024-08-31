import { JsonSchema } from "./JsonSchema"
import { SqsConsumerPayloadSchema } from "./SqsConsumerPayloadSchema"
import { SQSRecordSchema } from "./SQSRecordSchema"

export const SqsRecordWithPayloadSchema = SQSRecordSchema.extend({
  body: JsonSchema.pipe(SqsConsumerPayloadSchema),
})