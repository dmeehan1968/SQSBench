import { RefinementCtx, z } from "zod"

export const isMinRateLteMaxRate = (arg: { minRate: number, maxRate: number }, ctx: RefinementCtx) => {
  if (arg.minRate <= arg.maxRate) {
    return
  }

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: `minRate (${arg.minRate}) must be less than or equal to maxRate (${arg.maxRate})`,
  })
}

const QueueUrlSchema = z.string().regex(/^https:\/\/sqs\.[a-z0-9-]+\.amazonaws\.com\/[0-9]{12}\/[a-zA-Z0-9_-]+$/)
const TokenSchema = z.string().regex(/^\${Token\[TOKEN.\d+]}$/)
const LambdaArnSchema = z.string().regex(/^arn:aws:lambda:[a-z0-9-]+:[0-9]{12}:function:[a-zA-Z0-9_-]+$/)

export const SqsProducerControllerSettingsSchema =
  z.object({
    minRate: z.number().int().positive(),
    maxRate: z.number().int().positive(),
    rateDurationInMinutes: z.number().int().positive(),
    rateScaleFactor: z.number().positive(),
    dutyCycle: z.number().min(0).max(1).default(0.75),
    parameterName: z.string().min(1),
    queueUrls: z.array(z.union([QueueUrlSchema, TokenSchema])),
    emitterArn: z.union([LambdaArnSchema, TokenSchema]),
  })
    .superRefine(isMinRateLteMaxRate)

export type SqsProducerControllerSettings = z.infer<typeof SqsProducerControllerSettingsSchema>

