import { ConsumerMetrics } from "./consumerMetrics.mjs"
import { Record } from "./record.mjs"

export interface Delay {
  (): Promise<void>
}

interface ControllerParams {
  records: Record[]
  metrics: ConsumerMetrics
  nonConcurrentDelay: Delay
}

export async function controller({ records, metrics, nonConcurrentDelay }: ControllerParams) {

  await metrics.addMessagesReceived(records.length)

  return Promise.allSettled(records.map(_record => nonConcurrentDelay()))
}

