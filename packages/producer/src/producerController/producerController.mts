import { weightedMessageDistribution } from "../weightedMessageDistribution.mjs"
import pLimit from "p-limit-esm"
import { Logger } from "@aws-lambda-powertools/logger"
import { InvocationType, InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda"
import { GetParameterCommand, PutParameterCommand, SSMClient } from "@aws-sdk/client-ssm"
import { Context } from "aws-lambda"
import { z } from "zod"
import { chunkArray, splitSettledResults } from 'packages/helpers/src/index.mjs'
import {
  JsonSchema,
  SqsEmitterSettings,
  SqsProducerControllerSettings,
  SqsProducerControllerSettingsSchema,
} from "packages/schema/src/index.mjs"
import { isIdlePhase } from "./isIdlePhase.mjs"

const ProducerStateSchema = z.object({
  rate: z.number().default(0),
  rateChangeAt: z.coerce.date().optional(),
}).default({})
type SqsProducerState = z.infer<typeof ProducerStateSchema>

interface SendMessagesProps {
  rate: number
  weightDistribution: number[]
  queueUrls: string[]
  emit: { (queueUrl: string, chunk: number[]): Promise<any> }
  logger: Logger
}

interface GetStateProps {
  parameterName: string
  minRate: number
  maxRate: number
  rateScaleFactor: number
  rateDurationInMinutes: number
  currentTime: Date
  logger: Logger
  ssm: SSMClient
}

interface InvokeEmitterProps {
  delays: number[]
  queueUrl: string
  emitterArn: string
  currentTime: Date
  lambda: LambdaClient
}

interface ProducerControllerProps {
  event: unknown
  context: Context
  logger: Logger
  ssm: SSMClient
  lambda: LambdaClient
}

export async function producerController({ event, logger, lambda, ssm }: ProducerControllerProps) {

  try {

    logger.appendKeys({ lambdaEvent: event })

    const settings = getEventSettings(event)
    const currentTime = getCurrentTime()
    const state = await getState({ ...settings, logger, ssm, currentTime })

    logger.appendKeys({ state })

    if (isIdlePhase({ ...state, ...settings, currentTime, logger })) {
      return
    }

    await sendMessages({
      ...state,
      ...settings,
      emit: (queueUrl, delays) => invokeEmitter({
        delays,
        queueUrl,
        emitterArn: settings.emitterArn,
        currentTime,
        lambda,
      }),
      logger,
    })

  } finally {
    logger.info('Done')
  }

}

async function sendMessages({ rate, weightDistribution, queueUrls, emit, logger }: SendMessagesProps): Promise<void> {

  // Generate random delays for each message
  const delays = weightedMessageDistribution(rate, 60, weightDistribution)
  logger.appendKeys({ delays })

  // limit concurrency to 50, same as lambda client connection limit
  const limit = pLimit(50)

  // Send 500 delays to each emitter invocation (which results in 50 batch sends of 10 messages each)
  const pending = chunkArray(delays, 500)
    .flatMap(chunk =>
      queueUrls.map(queueUrl =>
        limit(() => emit(queueUrl, chunk)),
      ),
    )

  const { fulfilled, rejected } = splitSettledResults(await Promise.allSettled(pending))
  logger.appendKeys({
    emitterInvocations: fulfilled,
  })

  if (rejected.length > 0) {
    logger.error('Rejected emitter invocations', { rejected })
  }

}

async function putState(parameterName: string, rate: number, rateChangeAt: Date, ssm: SSMClient) {
  return await ssm.send(new PutParameterCommand({
    Name: parameterName,
    Value: JSON.stringify({
      rate,
      rateChangeAt,
    } satisfies SqsProducerState),
    Overwrite: true,
  }))
}

function getCurrentTime(): Date {
  // Start at the top of the next minute
  const currentTime = new Date()
  currentTime.setSeconds(0, 0)
  currentTime.setMinutes(currentTime.getMinutes() + 1)
  return currentTime
}

async function getStateFromParameter(parameterName: string, ssm: SSMClient, logger: Logger): Promise<SqsProducerState> {

  const res = await ssm.send(new GetParameterCommand({
    Name: parameterName,
  }))

  let state = ProducerStateSchema.parse(undefined)

  try {
    state = JsonSchema.pipe(ProducerStateSchema).parse(res.Parameter?.Value)
  } catch (error) {
    logger.error('Invalid parameter value, using default', {
      value: res.Parameter?.Value,
      error,
      default: state,
    })
  }

  return state

}

async function getState({
                          parameterName, minRate,
                          maxRate,
                          rateScaleFactor,
                          rateDurationInMinutes,
                          currentTime,
                          logger,
                          ssm,
                        }: GetStateProps): Promise<Required<SqsProducerState>> {

  let state = await getStateFromParameter(parameterName, ssm, logger)

  let { rate, rateChangeAt } = state

  if (rateChangeAt === undefined || currentTime >= rateChangeAt) {
    if (rateChangeAt !== undefined) {
      rate = rate === 0
        ? minRate
        : rate < maxRate
          ? rate * rateScaleFactor
          : 0
    }

    rateChangeAt = new Date(currentTime)
    if (rate === 0) {
      rateChangeAt.setHours(rateChangeAt.getHours() + 1, 0, 0, 0)
    } else {
      rateChangeAt.setMinutes(rateChangeAt.getMinutes() + rateDurationInMinutes, 0, 0)
    }
    const response = await putState(parameterName, rate, rateChangeAt, ssm)

    logger.appendKeys({ putParameterResponse: response })
  }

  return { rate, rateChangeAt }
}

async function invokeEmitter({ delays, queueUrl, emitterArn, currentTime, lambda }: InvokeEmitterProps) {
  const payload: SqsEmitterSettings = {
    queueUrl, delays, currentTime,
  }
  const response = await lambda.send(new InvokeCommand({
    FunctionName: emitterArn,
    InvocationType: InvocationType.Event,
    Payload: Buffer.from(JSON.stringify(payload)),
  }))
  if (response.StatusCode === undefined || response.StatusCode < 200 || response.StatusCode >= 300) {
    throw new Error('Lambda invocation failed', { cause: response })
  }
  return response
}

function getEventSettings(event: unknown): SqsProducerControllerSettings {
  const settings = SqsProducerControllerSettingsSchema.parse(event)

  if (!Array.isArray(settings.queueUrls) || settings.queueUrls.length === 0) {
    throw new Error('No queues')
  }

  return settings
}