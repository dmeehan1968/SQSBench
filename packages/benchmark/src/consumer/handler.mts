import { MetricResolution, Metrics, MetricUnit } from "@aws-lambda-powertools/metrics"
import { Logger } from "@aws-lambda-powertools/logger"
import { ConsumerEnvironment } from "./consumerEnvironment.mjs"
import pLimit from "p-limit-esm"
import { nodeRelativeTimeout } from "./nodeRelativeTimeout.mjs"
import { Environment } from "./environment.mjs"
import { Duration } from "@sqsbench/helpers"
import { processBatchItems } from "./processBatchItems.mjs"
import { createHandler } from "./createHandler.mjs"

const [ metrics, logger ] = await Promise.all([
  Promise.resolve(new Metrics()),
  Promise.resolve(new Logger()),
])
const env = new Environment<ConsumerEnvironment>(process.env)
const highResMetrics = env.get(ConsumerEnvironment.HighResMetrics).required().asBoolean()
const perMessageDuration = env.get(ConsumerEnvironment.PerMessageDuration).required().as(v => Duration.parse(v))
const limit = pLimit(1)
const synchronousDelay = () => limit(() => nodeRelativeTimeout(perMessageDuration))

export const handler = createHandler({
  getLogger: () => ({
    [Symbol.dispose]: () => {
      logger.info('Exiting')
      metrics.publishStoredMetrics()
    },
    context: context => logger.addContext(context),
    perMessageDuration: duration => logger.appendKeys({ perMessageDuration: duration }),
    highResMetrics: enabled => logger.appendKeys({ highResMetrics: enabled }),
    messagesReceived: count => metrics.addMetric(
      'MessagesReceived',
      MetricUnit.Count,
      count,
      highResMetrics ? MetricResolution.High : MetricResolution.Standard,
    ),
    error: error => logger.error('Error', { error }),
  }),
  processBatchItems,
  processRecord: synchronousDelay,
})

