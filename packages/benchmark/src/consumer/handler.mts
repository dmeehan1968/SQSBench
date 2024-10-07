import { MetricResolution, Metrics, MetricUnit } from "@aws-lambda-powertools/metrics"
import { Logger } from "@aws-lambda-powertools/logger"
import { ConsumerEnvironment } from "./consumerEnvironment.mjs"
import pLimit from "p-limit-esm"
import { nodeRelativeTimeout } from "./nodeRelativeTimeout.mjs"
import { Environment } from "./environment.mjs"
import { clamp, Duration } from "@sqsbench/helpers"
import { processBatchItems } from "./processBatchItems.mjs"
import { createHandler } from "./createHandler.mjs"
import { Context } from "aws-lambda"

const [metrics, logger] = await Promise.all([
  new Promise<Metrics>(resolve => resolve(new Metrics())),
  new Promise<Logger>(resolve => resolve(new Logger())),
])

const env = new Environment<ConsumerEnvironment>(process.env)
const highResMetrics = env.get(ConsumerEnvironment.HighResMetrics).required().asBoolean()
const perMessageDuration = env.get(ConsumerEnvironment.PerMessageDuration).required().as(v => Duration.parse(v))
const limit = pLimit(1)
const synchronousDelay = () => limit(() => nodeRelativeTimeout(perMessageDuration))

/**
 * This creates the inner handler which does the work, with the implementation specific
 * details
 */
const _handler = createHandler({
  log: {
    context: context => logger.addContext(context),
    perMessageDuration: () => logger.appendKeys({ perMessageDuration }),
    highResMetrics: () => logger.appendKeys({ highResMetrics }),
    messagesReceived: count => metrics.addMetric(
      'MessagesReceived',
      MetricUnit.Count,
      count,
      highResMetrics ? MetricResolution.High : MetricResolution.Standard,
    ),
    latency: sentAt => metrics.addMetric(
      'Latency',
      MetricUnit.Milliseconds,
      clamp(Date.now() - sentAt.getTime(), { max: Infinity }),
    ),
    error: error => logger.error('Error', { error }),
  },
  processBatchItems,
  processRecord: synchronousDelay,
})

/**
 * This is the actual handler entry point and ensures that the logger and metrics
 * are flushed after the inner handler has completed
 */
export const handler = async (event: unknown, context: Context) => {
  // @ts-ignore
  // noinspection JSUnusedLocalSymbols
  using logOnExit = {
    [Symbol.dispose]: () => {
      logger.info('Done')
      metrics.publishStoredMetrics()
    },
  }

  return await _handler(event, context)
}