import { SqsEmitterSettings } from "@sqsbench/schema"
import { chunkArray, clamp } from "@sqsbench/helpers"
import pLimit from "p-limit-esm"

class MessageDelay {

  protected constructor(private readonly milliseconds: number) {
    this.milliseconds = clamp(milliseconds, { min: 0, max: 15 * 60 * 1000 })
  }

  static seconds(seconds: number): MessageDelay {
    return new MessageDelay(seconds * 1000)
  }

  static milliseconds(msecs: number): MessageDelay {
    return new MessageDelay(msecs)
  }

  toSeconds({ integral = true, transform }: { integral?: boolean, transform?: (value: number) => number } = {}): number {
    let seconds = this.milliseconds / 1000
    seconds = transform ? transform(seconds) : seconds
    if (integral && (Math.trunc(seconds) !== seconds)) {
      throw new Error('Delay is not an integral number of seconds')
    }
    return seconds
  }
}

export interface MessageEntry {
  delay: MessageDelay
  body: { index: number, delay: number }
}

export interface MessageBatchSender {
  sendMessageBatch: (entries: MessageEntry[]) => Promise<any>
}

export interface MessageStatsLogger {
  (stats: { min: number, max: number, avg: number }): void
}

export interface SendMessageErrorLogger {
  (error: Error): void
}

export interface EmitterControllerParams extends Pick<SqsEmitterSettings, 'delays' | 'currentTime'> {
  maxConcurrency: number
  batchSize: number
}

export async function emitterController(
  { delays, currentTime, maxConcurrency, batchSize }: EmitterControllerParams,
  { queue, logMessageStats, logSendMessageError }: {
    queue: MessageBatchSender,
    logMessageStats: MessageStatsLogger,
    logSendMessageError: SendMessageErrorLogger,
  },
) {

  batchSize = clamp(batchSize, { min: 1, max: 10, throws: true })
  maxConcurrency = clamp(maxConcurrency, { min: 1, max: 50, throws: true })

  const latencies: number[] = []
  const limit = pLimit(maxConcurrency)

  const pending = chunkArray(delays, batchSize).map(chunk => {
    return limit(() => {
      return queue.sendMessageBatch(chunk.map((delay, index) => {
        const timeToSend = new Date(currentTime)
        timeToSend.setSeconds(timeToSend.getSeconds() + delay)
        const latencyMs = Date.now() - timeToSend.getTime()
        latencies.push(latencyMs)
        return {
          delay: MessageDelay.milliseconds(timeToSend.getTime() - Date.now()),
          body: { index, delay },
        }
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
  logMessageStats(stats)

  // console.log('Batch Send Results', JSON.stringify(res))
  res.filter(res => res.status === 'rejected').forEach(res => {
    logSendMessageError(res.reason)
  })

}