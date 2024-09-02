import { GetParameterCommand, PutParameterCommand, SSMClient } from "@aws-sdk/client-ssm"
import { SendMessageBatchCommand, SQSClient } from "@aws-sdk/client-sqs"
import { InvocationType, InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda"
import { Logger } from "@aws-lambda-powertools/logger"
import middy from "@middy/core"
import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware"
import { Context } from "aws-lambda"
import { z } from "zod"
import { SqsProducerSettingsSchema } from "@sqsbench/schema"
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

    const { dutyCycle, parameterName, queueUrls } = producerSettings

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

    const isIdlePhase = startTime.getMinutes() >= (60 * dutyCycle)

    let settings: { rate: number } = { rate: 1 }

    if (res.Parameter) {
      // console.log('Parameter', res.Parameter.Value)
      settings = JSON.parse(res.Parameter.Value ?? '{ "rate": 1 }')
    }

    this.logger.info('Settings', { settings })

    if (startTime.getMinutes() === 0) {
      await this.ssm.send(new PutParameterCommand({
        Name: parameterName,
        Value: JSON.stringify({ rate: settings.rate < 4096 ? settings.rate * 2 : 1 }),
        Overwrite: true,
      }))
    }

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
        latencies.push(Date.now() - startTime.getTime())
        return this.sqs.send(new SendMessageBatchCommand({
          QueueUrl: queueUrl,
          Entries: chunk.map((delay, index) => ({
            Id: index.toString(),
            DelaySeconds: clamp(delay - Math.floor((Date.now() - startTime.getTime()) / 1000), { max: 60 }),
            MessageBody: JSON.stringify({ index, delay }),
          })),
        }))
      })
    })

    const res = await Promise.allSettled(pending)

    this.logger.info('Latencies (ms per batch of 10)', { latencies })

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

