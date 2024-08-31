import { JsonSchema, SqsConsumerPayloadSchema, SQSRecordSchema } from "@sqsbench/schema"

export const SqsRecordWithPayloadSchema = SQSRecordSchema.extend({
  body: JsonSchema.pipe(SqsConsumerPayloadSchema),
})