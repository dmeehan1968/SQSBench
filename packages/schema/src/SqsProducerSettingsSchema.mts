import { z } from "zod"

export const SqsProducerSettingsSchema = z.object({
  dutyCycle: z.number(),
  parameterName: z.string(),
  queueUrls: z.string().array(),
  minRate: z.number(),
  maxRate: z.number(),
})
export type SqsProducerSettings = z.infer<typeof SqsProducerSettingsSchema>