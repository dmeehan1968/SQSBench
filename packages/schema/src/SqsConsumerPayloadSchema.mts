import { z } from "zod"

export const SqsConsumerPayloadSchema = z.object({
  index: z.number(),
  delay: z.number(),
  sendAt: z.coerce.date().optional()
})