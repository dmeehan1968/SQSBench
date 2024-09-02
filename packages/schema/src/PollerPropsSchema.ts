import { z } from "zod"

export const PollerPropsSchema = z.object({
  queueUrl: z.string(),
  queueArn: z.string(),
  functionArn: z.string(),
  batchSize: z.number(),
  batchWindow: z.number(),
  maxSessionDuration: z.number(),
  maxConcurrency: z.number(),
})

export type PollerProps = z.infer<typeof PollerPropsSchema>