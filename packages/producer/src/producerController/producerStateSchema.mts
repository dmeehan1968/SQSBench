import { z } from "zod"

export const ProducerStateSchema = z.object({
  rate: z.number().default(0),
  rateChangeAt: z.coerce.date().optional(),
}).default({})
export type ProducerState = z.infer<typeof ProducerStateSchema>