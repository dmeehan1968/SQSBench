import { MiddlewareObj } from "@middy/core"
import { SQSRecord } from "aws-lambda"
import { z } from "zod"
import { SQSRecordSchema } from "@sqsbench/schema"

export const sqsRecordNormalizer = (): MiddlewareObj<SQSRecord[], void> => {

  const EventSchema = z.union([
    SQSRecordSchema.transform(record => ([record])),
    SQSRecordSchema.array(),
    z.object({ Records: SQSRecordSchema.array() }).transform(event => event.Records),
  ])

  return {
    before: request => {
      request.event = EventSchema.parse(request.event)
    },
  }
}