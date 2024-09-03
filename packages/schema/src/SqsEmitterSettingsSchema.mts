import { z } from "zod"

export const SqsEmitterSettingsSchema = z.object({
  queueUrl: z.string(),
  delays: z.number().array(),
  startTime: z.coerce.date(),
})

export type SqsEmitterSettings = z.infer<typeof SqsEmitterSettingsSchema>