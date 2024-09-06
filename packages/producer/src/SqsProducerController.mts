import { GetParameterCommand, PutParameterCommand, SSMClient } from "@aws-sdk/client-ssm"
import { InvocationType, InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda"
import { Logger } from "@aws-lambda-powertools/logger"
import middy from "@middy/core"
import errorLogger from "@middy/error-logger"
import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware"
import { Context } from "aws-lambda"
import { z } from "zod"
import {
  JsonSchema,
  SqsEmitterSettings,
  SqsProducerControllerSettings,
  SqsProducerControllerSettingsSchema,
} from "@sqsbench/schema"
import pLimit from "p-limit"
import { chunkArray, splitSettledResults } from "@sqsbench/helpers"
import { weightedMessageDistribution } from "./weightedMessageDistribution.mjs"

const ProducerStateSchema = z.object({
  rate: z.number().default(0),
  rateChangeAt: z.coerce.date().optional(),
}).default({})

type ProducerState = z.infer<typeof ProducerStateSchema>

export class SqsProducerController {
  constructor(
    private readonly ssm: SSMClient,
    private readonly lambda: LambdaClient,
    private readonly logger: Logger,
  ) {
  }

  get handler() {
    return middy()
      .use(errorLogger({ logger: error => this.logger.error('Error', { error }) }))
      .use(injectLambdaContext(this.logger, { resetKeys: true }))
      .handler(this._handler.bind(this))
  }

  private async _handler(unknown: unknown, _context: Context) {

    try {

      this.logger.appendKeys({ lambdaEvent: unknown })

      const settings = this.getEventSettings(unknown)
      const startTime = this.getStartTime()
      const state = await this.getState(settings, startTime)

      this.logger.appendKeys({ state })

      if (this.isIdlePhase(state, settings, startTime)) {
        return
      }

      await this.sendMessages(state, settings, startTime)

    } finally {
      this.logger.info('Done')
    }

  }

  private isIdlePhase(
    state: Required<ProducerState>,
    settings: SqsProducerControllerSettings,
    startTime: Date
  ) {
    const commencedAt = state.rateChangeAt.getTime() - (settings.rateDurationInMinutes * 60 * 1000)
    const elapsedMins = (startTime.getTime() - commencedAt) / 1000 / 60

    const isIdlePhase = elapsedMins >= (settings.rateDurationInMinutes * settings.dutyCycle) || state.rate === 0

    this.logger.appendKeys({
      elapsedMins,
      rateDurationInMinutes: settings.rateDurationInMinutes,
      dutyCycle: settings.dutyCycle,
      isIdlePhase,
    })
    return isIdlePhase
  }

  private async sendMessages(
    state: Required<ProducerState>,
    settings: SqsProducerControllerSettings,
    startTime: Date
  ): Promise<void> {

    // Generate random delays for each message
    const delays = weightedMessageDistribution(state.rate, 60, settings.weightDistribution)
    this.logger.appendKeys({ delays })

    // limit concurrency to 50, same as lambda client connection limit
    const limit = pLimit(50)

    // Send 500 delays to each emitter invocation (which results in 50 batch sends of 10 messages each)
    const pending = chunkArray(delays, 500)
      .flatMap(chunk =>
        settings.queueUrls.map(queueUrl =>
          limit(() => this.invokeEmitter(chunk, queueUrl, settings, startTime)),
        ),
      )

    const { fulfilled, rejected } = splitSettledResults(await Promise.allSettled(pending))
    this.logger.appendKeys({
      emitterInvocations: fulfilled,
    })

    if (rejected.length > 0) {
      this.logger.error('Rejected emitter invocations', { rejected })
    }
  }

  private async invokeEmitter(delays: number[], queueUrl: string, settings: SqsProducerControllerSettings, startTime: Date) {
    const payload: SqsEmitterSettings = {
      queueUrl, delays, startTime
    }
    const response = await this.lambda.send(new InvokeCommand({
      FunctionName: settings.emitterArn,
      InvocationType: InvocationType.Event,
      Payload: Buffer.from(JSON.stringify(payload)),
    }))
    if (response.StatusCode === undefined || response.StatusCode < 200 || response.StatusCode >= 300) {
      throw new Error('Lambda invocation failed', { cause: response })
    }
    return response
  }

  private getEventSettings(unknown: any): SqsProducerControllerSettings {
    const settings = SqsProducerControllerSettingsSchema.parse(unknown)

    if (!Array.isArray(settings.queueUrls) || settings.queueUrls.length === 0) {
      throw new Error('No queues')
    }

    return settings
  }

  private getStartTime(): Date {
    // Start at the top of the next minute
    const startTime = new Date()
    startTime.setSeconds(0, 0)
    startTime.setMinutes(startTime.getMinutes() + 1)
    return startTime
  }

  private async getState(
    settings: SqsProducerControllerSettings,
    startTime: Date,
  ): Promise<Required<ProducerState>> {

    let state = await this.getStateFromParameter(settings.parameterName)

    let { rate, rateChangeAt } = state

    if (rateChangeAt === undefined || startTime >= rateChangeAt) {
      if (rateChangeAt !== undefined) {
        rate = rate === 0
          ? settings.minRate
          : rate < settings.maxRate
            ? rate * settings.rateScaleFactor
            : 0
      }

      rateChangeAt = new Date(startTime)
      if (rate === 0) {
        rateChangeAt.setHours(rateChangeAt.getHours() + 1, 0, 0, 0)
      } else {
        rateChangeAt.setMinutes(rateChangeAt.getMinutes() + settings.rateDurationInMinutes, 0, 0)
      }
      const response = await this.putState(settings.parameterName, rate, rateChangeAt)

      this.logger.appendKeys({ putParameterResponse: response })
    }

    return { rate, rateChangeAt }
  }

  private async putState(parameterName: string, rate: number, rateChangeAt: Date) {
    return await this.ssm.send(new PutParameterCommand({
      Name: parameterName,
      Value: JSON.stringify({
        rate,
        rateChangeAt
      } satisfies ProducerState),
      Overwrite: true,
    }))
  }

  private async getStateFromParameter(parameterName: string) {

    const res = await this.ssm.send(new GetParameterCommand({
      Name: parameterName,
    }))

    let state = ProducerStateSchema.parse(undefined)

    try {
      state = JsonSchema.pipe(ProducerStateSchema).parse(res.Parameter?.Value)
    } catch (error) {
      this.logger.error('Invalid parameter value, using default', {
        value: res.Parameter?.Value,
        error,
        default: state,
      })
    }

    return state
  }
}

