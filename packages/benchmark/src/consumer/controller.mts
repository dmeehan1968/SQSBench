import { Milliseconds } from "./milliseconds.mjs"
import { ConsumerMetrics } from "./consumerMetrics.mjs"
import { ConsumerLogger, Record } from "./consumerLogger.mjs"
import { RelativeTimeout } from "./relativeTimeout.mjs"
import { ConcurrencyLimiter } from "./concurrencyLimiter.mjs"

interface ControllerParams {
  records: Record[]
  perMessageDuration: Milliseconds
  metrics: ConsumerMetrics
  logger: ConsumerLogger
  timeoutAfter: RelativeTimeout
  atMostOneConcurrently: ConcurrencyLimiter
}

export async function controller({ records, perMessageDuration, metrics, logger, timeoutAfter, atMostOneConcurrently }: ControllerParams) {

  await logger.perMessageDuration(perMessageDuration)
  await logger.recordsReceived(records)
  await metrics.addMessagesReceived(records.length)

  return Promise.allSettled(records.map(_record => atMostOneConcurrently(() => timeoutAfter(perMessageDuration))))
}

