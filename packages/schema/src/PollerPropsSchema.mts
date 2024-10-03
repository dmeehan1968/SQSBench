import { z } from "zod"
import { InvocationType } from '@aws-sdk/client-lambda'

export const PollerPropsSchema = z.object({
  queueUrl: z.string(),
  queueArn: z.string(),
  functionArn: z.string(),
  batchSize: z.number(),
  batchWindow: z.number(),
  maxSessionDuration: z.number(),
  maxConcurrency: z.number(),
  invocationType: z.nativeEnum(InvocationType),
})

export type PollerProps = z.infer<typeof PollerPropsSchema>