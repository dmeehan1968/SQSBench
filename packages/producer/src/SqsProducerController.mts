import { GetParameterCommand, PutParameterCommand, SSMClient } from "@aws-sdk/client-ssm"
import { SendMessageBatchCommand, SQSClient } from "@aws-sdk/client-sqs"
import { InvocationType, InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda"
import { Logger } from "@aws-lambda-powertools/logger"
import middy from "@middy/core"
import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware"
import { Context } from "aws-lambda"
import { z } from "zod"
import { JsonSchema, SqsProducerSettingsSchema } from "@sqsbench/schema"
import pLimit from "p-limit"
import { chunkArray, clamp } from "@sqsbench/helpers"

const SendMessagesSchema = z.object({
  queueUrl: z.string(),
  delays: z.number().array(),
  startTime: z.coerce.date(),
})

export class SqsProducerController {
  constructor(
    private readonly ssm: SSMClient,
    private readonly sqs: SQSClient,
    private readonly lambda: LambdaClient,
    private readonly logger: Logger,
  ) {
  }

  get handler() {
    return middy()
      .use(injectLambdaContext(this.logger))
      .handler(this._handler.bind(this))
  }

  private async _handler(unknown: unknown, context: Context) {

    this.logger.info('Event', { event: unknown })

    const messageSettings = SendMessagesSchema.safeParse(unknown)

    if (messageSettings.success) {
      const { queueUrl, delays, startTime } = messageSettings.data
      await this.sendMessages(queueUrl, delays, startTime)
      return
    }

    const producerSettings = SqsProducerSettingsSchema.parse(unknown)

    const { dutyCycle, parameterName, queueUrls, minRate, maxRate } = producerSettings

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

    // start at 0 rate, which will be idle until top of the next hour
    let settings: { rate: number } = { rate: 0 }

    if (res.Parameter) {
      // if this fails we'll just use the default settings
      try {
        settings = JsonSchema.pipe(z.object({ rate: z.number() })).parse(res.Parameter.Value)
      } catch (_err) {}
    }

    this.logger.info('Settings', { settings })

    if (startTime.getMinutes() === 0) {
      settings.rate = settings.rate === 0
        ? minRate
        : settings.rate < maxRate
          ? settings.rate * 2
          : 0
      await this.ssm.send(new PutParameterCommand({
        Name: parameterName,
        Value: JSON.stringify(settings),
        Overwrite: true,
      }))
    }

    const isIdlePhase = startTime.getMinutes() >= (60 * dutyCycle) || settings.rate === 0

    if (isIdlePhase) {
      this.logger.info('Idle Phase - No actions')
      return
    }

    this.logger.info(`Duty Phase - Send ${settings.rate} messages`)

    // Generate random delays for each message
    const delays = Array.from({ length: settings.rate }, () => this.getRandomDelay()).sort((a, b) => a - b)

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
            FunctionName: context.invokedFunctionArn,
            InvocationType: InvocationType.Event,
            Payload: Buffer.from(JSON.stringify({
              queueUrl,
              delays: chunk,
              startTime,
            } satisfies z.infer<typeof SendMessagesSchema>)),
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

  private async sendMessages(queueUrl: string, delays: number[], startTime: Date) {

    const latencies: number[] = []
    const limit = pLimit(50)

    const pending = chunkArray(delays, 10).map(chunk => {
      return limit(() => {
        return this.sqs.send(new SendMessageBatchCommand({
          QueueUrl: queueUrl,
          Entries: chunk.map((delay, index) => {
            const timeToSend = startTime.getTime() + (delay * 1000)
            const latencyMs = Date.now() - timeToSend
            latencies.push(latencyMs)
            const DelaySeconds = clamp(Math.floor((timeToSend - Date.now()) / 1000), { max: 900 })
            return {
              Id: index.toString(),
              DelaySeconds,
              MessageBody: JSON.stringify({ index, delay }),
            }
          }),
        }))
      })
    })

    const res = await Promise.allSettled(pending)

    const stats = latencies.reduce((acc, latency) => {
      return {
        ...acc,
        min: Math.min(acc.min, latency),
        max: Math.max(acc.max, latency),
      }
    }, { min: Infinity, max: -Infinity, avg: 0 })
    stats.avg = latencies.reduce((acc, latency) => acc + latency, 0) / latencies.length
    this.logger.info('Latencies (ms)', { latencies: stats })

    // console.log('Batch Send Results', JSON.stringify(res))
    res.filter(res => res.status === 'rejected').forEach(res => {
      this.logger.error('Batch Send Error', { error: res.reason })
    })

  }

  getRandomDelay() {
    const baseDelay = Math.floor(Math.random() * 20)

    // Add some randomness for busy/quiet periods
    const busyPeriod = Math.random() < 0.5 ? 0 : Math.floor(Math.random() * 40)

    return Math.min(baseDelay + busyPeriod, 60)
  }

}
