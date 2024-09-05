import { GetParameterCommand, PutParameterCommand, SSMClient } from "@aws-sdk/client-ssm"
import { InvocationType, InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda"
import { Logger } from "@aws-lambda-powertools/logger"
import middy from "@middy/core"
import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware"
import { Context } from "aws-lambda"
import { z } from "zod"
import { SqsEmitterSettings, JsonSchema, SqsProducerControllerSettingsSchema } from "@sqsbench/schema"
import pLimit from "p-limit"
import { chunkArray } from "@sqsbench/helpers"
import { weightedMessageDistribution } from "./weightedMessageDistribution.mjs"

export class SqsProducerController {
  constructor(
    private readonly ssm: SSMClient,
    private readonly lambda: LambdaClient,
    private readonly logger: Logger,
  ) {
  }

  get handler() {
    return middy()
      .use(injectLambdaContext(this.logger))
      .handler(this._handler.bind(this))
  }

  private async _handler(unknown: unknown, _context: Context) {

    this.logger.info('Event', { event: unknown })

    const {
      dutyCycle,
      parameterName,
      queueUrls,
      minRate,
      maxRate,
      emitterArn,
      rateDurationInMinutes,
      rateScaleFactor,
      weightDistribution
    } = SqsProducerControllerSettingsSchema.parse(unknown)

    if (!Array.isArray(queueUrls) || queueUrls.length === 0) {
      throw new Error('No queues')
    }

    const res = await this.ssm.send(new GetParameterCommand({
      Name: parameterName,
    }))

    // Start at the top of the next minute
    const startTime = new Date()
    startTime.setSeconds(0, 0)
    startTime.setMinutes(startTime.getMinutes() + 1)

    const ParameterSchema = z.object({
      rate: z.number().default(0),
      rateChangeAt: z.coerce.date().optional(),
    }).default({})

    let settings = ParameterSchema.parse(undefined)

    try {
      settings = JsonSchema.pipe(ParameterSchema).parse(res.Parameter?.Value)
    } catch (error) {
      this.logger.error('Invalid parameter value, using default', { value: res.Parameter?.Value, error, default: settings })
    }

    this.logger.info('Settings', { settings })

    if (settings.rateChangeAt === undefined || new Date() > settings.rateChangeAt) {
      if (settings.rateChangeAt !== undefined) {
        settings.rate = settings.rate === 0
          ? minRate
          : settings.rate < maxRate
            ? settings.rate * rateScaleFactor
            : 0
      }

      settings.rateChangeAt = new Date()
      if (settings.rate === 0) {
        settings.rateChangeAt.setHours(settings.rateChangeAt.getHours() + 1, 0, 0, 0)
      } else {
        settings.rateChangeAt.setMinutes(settings.rateChangeAt.getMinutes() + rateDurationInMinutes, 0, 0)
      }

      await this.ssm.send(new PutParameterCommand({
        Name: parameterName,
        Value: JSON.stringify(settings),
        Overwrite: true,
      }))
    }

    const commencedAt = settings.rateChangeAt.getTime() - (rateDurationInMinutes * 60 * 1000)
    const elapsedMins = (startTime.getTime() - commencedAt) / 1000 / 60
    const isIdlePhase = elapsedMins >= (rateDurationInMinutes * dutyCycle) || settings.rate === 0

    if (isIdlePhase) {
      this.logger.info('Idle Phase - No actions')
      return
    }

    this.logger.info(`Duty Phase - Send ${settings.rate} messages`)

    // Generate random delays for each message
    const delays = weightedMessageDistribution(settings.rate, 60, weightDistribution)

    const pending: Promise<any>[] = []

    // limit concurrency to 50, same as lambda client connection limit
    const limit = pLimit(50)

    // Send 500 delays to each lambda invocation (which result in 50 batch sends of 10 messages)
    const chunks = chunkArray(delays, 500)

    for (let chunk of chunks) {
      for (let queueUrl of queueUrls) {
        pending.push(limit(async () => {
          this.logger.info(`Sending ${chunk.length} messages to ${queueUrl}`)
          const res = await this.lambda.send(new InvokeCommand({
            FunctionName: emitterArn,
            InvocationType: InvocationType.Event,
            Payload: Buffer.from(JSON.stringify({
              queueUrl,
              delays: chunk,
              startTime,
            } satisfies SqsEmitterSettings)),
          }))
          if (res.StatusCode === undefined || res.StatusCode < 200 || res.StatusCode >= 300) {
            this.logger.error('Lambda invocation failed', { response: res })
          }
          return res
        }))
      }
    }

    await Promise.allSettled(pending)

  }

}

