import { z } from "zod"

export const SqsProducerSettingsSchema = z.object({
  dutyCycle: z.number(),
  parameterName: z.string(),
  queueUrls: z.string().array(),
})
export type SqsProducerSettings = z.infer<typeof SqsProducerSettingsSchema>