import { MiddlewareObj } from "@middy/core"
import { Context, SQSBatchResponse } from "aws-lambda"
import { z } from "zod"
import { SQSRecordSchema } from "@sqsbench/schema"

const SQSRecordWithAnyBodySchema = SQSRecordSchema.extend({ body: z.any() })
type SQSRecordWithAnyBody = z.infer<typeof SQSRecordWithAnyBodySchema>

/**
 * Middleware that transforms the response to include a list of batch item failures
 *
 * The event is expected to be an array of SQS records (with any body)
 * The response is an object with a `batchItemFailures` property containing an array of batch item failures
 *
 * Message IDs are extracted from the event and used to match up with the response.  NOTE: the order
 * of the message IDs in the event must match the order of the response.
 */
export const batchItemFailures = (): MiddlewareObj<SQSRecordWithAnyBody[], PromiseSettledResult<unknown>[] | SQSBatchResponse, Error, Context, {
  itemIdentifiers?: string[]
}> => {

  return {
    before: request => {
      request.internal.itemIdentifiers = z.object({ messageId: z.string() })
        .transform(m => m.messageId)
        .array()
        .parse(request.event)
    },
    after: request => {
      const PromiseSettledSchema = z.discriminatedUnion('status', [
        z.object({ status: z.literal('fulfilled'), value: z.any() }),
        z.object({ status: z.literal('rejected'), reason: z.any() }),
      ])

      const response = PromiseSettledSchema.array().parse(request.response)

      const batchItemFailures = response
        .map((result, index) => result.status === 'rejected' ? request.internal.itemIdentifiers?.[index] : undefined)
        .filter((id): id is string => id !== undefined)
        .map(itemIdentifier => ({ itemIdentifier }))

      request.response = { batchItemFailures }
    },
    onError: request => {
      // mark all items as batch failures
      const batchItemFailures = request.internal.itemIdentifiers
          ?.map(itemIdentifier => ({ itemIdentifier }))
        ?? []

      request.response = { batchItemFailures }
    },
  }
}