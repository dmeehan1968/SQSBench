import { SendMessageBatchCommand, SQSClient } from "@aws-sdk/client-sqs"
import { Logger } from "@aws-lambda-powertools/logger"
import middy from "@middy/core"
import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware"
import { Context } from "aws-lambda"
import pLimit from "p-limit"
import { chunkArray, clamp } from "@sqsbench/helpers"
import { SqsEmitterSettingsSchema} from "@sqsbench/schema"

export class SqsEmitterController {

  constructor(
    private readonly sqs: SQSClient,
    private readonly logger: Logger,
  ) {}

  get handler() {
    return middy()
      .use(injectLambdaContext(this.logger))
      .handler(this._handler.bind(this))
  }

  private async _handler(unknown: unknown, _context: Context) {

    this.logger.info('Event', { event: unknown })

    const { queueUrl, delays, startTime } = SqsEmitterSettingsSchema.parse(unknown)

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

}

