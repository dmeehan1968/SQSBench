import pLimit from "p-limit-esm"
import { Environment } from "../../environment.mjs"
import { ConsumerEnvironment } from "../../consumerEnvironment.mjs"
import { Duration } from "@sqsbench/helpers"
import { Logger } from "@aws-lambda-powertools/logger"
import { MetricResolution, Metrics, MetricUnit } from "@aws-lambda-powertools/metrics"
import { ConsumerMessageProcessor } from "../useCases/consumerMessageProcessor.mjs"
import { ConsumerLambdaController } from "./consumerLambdaController.mjs"

const [logger, metrics] = await Promise.all([
  new Promise<Logger>(resolve => resolve(new Logger())),
  new Promise<Metrics>(resolve => resolve(new Metrics())),
])

const env = new Environment<ConsumerEnvironment>(process.env)
const highResMetrics = env.get(ConsumerEnvironment.HighResMetrics).required().asBoolean()
const perMessageDuration = env.get(ConsumerEnvironment.PerMessageDuration).required().as(v => Duration.parse(v))
const limit = pLimit(1)
const synchronousDelay = () => new Promise<void>(resolve => limit(() => setTimeout(resolve, perMessageDuration.toMilliseconds())))
const messageProcessor = new ConsumerMessageProcessor({
  logMessagesReceived: (count: number) => metrics.addMetric('MessagesReceived', MetricUnit.Count, count, highResMetrics ? MetricResolution.High : MetricResolution.Standard),
  synchronousDelay,
})

export const handler = new ConsumerLambdaController({
  messageProcessor,
  logPerMessageDuration: () => logger.appendKeys({ perMessageDuration }),
  logHighResMetrics: () => logger.appendKeys({ highResMetrics }),
}).handler()









