import { ConsumerMetrics } from "./consumerMetrics.mjs"
import { Record } from "./record.mjs"

interface ControllerParams {
  records: Record[]
  metrics: ConsumerMetrics
  nonConcurrentDelay: () => Promise<void>
}

export async function controller({ records, metrics, nonConcurrentDelay }: ControllerParams) {

  await metrics.addMessagesReceived(records.length)

  return Promise.allSettled(records.map(_record => nonConcurrentDelay()))
}

