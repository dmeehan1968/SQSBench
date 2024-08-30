import { SQSRecordSchema } from "@/Aws/schema/SQSRecordSchema"
import { JsonSchema } from "@/Aws/schema/JsonSchema"
import { SqsConsumerPayloadSchema } from "@/infra/SqsTest/SqsConsumerPayloadSchema"

export const SqsRecordWithPayloadSchema = SQSRecordSchema.extend({
  body: JsonSchema.pipe(SqsConsumerPayloadSchema),
})