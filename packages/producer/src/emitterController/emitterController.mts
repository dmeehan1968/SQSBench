import { SqsEmitterSettings } from "@sqsbench/schema"
import { chunkArray, clamp } from "@sqsbench/helpers"
import pLimit from "p-limit-esm"

export interface MessageEntry {
  id: string
  delaySeconds: number
  messageBody: string
}

export interface MessageBatchSender {
  (entries: MessageEntry[]): Promise<any>
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
  { sendMessageBatch, logMessageStats, logSendMessageError }: {
    sendMessageBatch: MessageBatchSender,
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
      return sendMessageBatch(chunk.map((delay, index) => {
        const timeToSend = new Date(currentTime)
        timeToSend.setSeconds(timeToSend.getSeconds() + delay)
        const latencyMs = Date.now() - timeToSend.getTime()
        latencies.push(latencyMs)
        const DelaySeconds = clamp(Math.floor((timeToSend.getTime() - Date.now()) / 1000), { max: 900 })
        return {
          id: index.toString(),
          delaySeconds: DelaySeconds,
          messageBody: JSON.stringify({ index, delay }),
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