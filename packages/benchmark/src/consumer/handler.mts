import { Metrics } from "@aws-lambda-powertools/metrics"
import middy from "@middy/core"
import { logMetrics } from "@aws-lambda-powertools/metrics/middleware"
import { parser } from "@aws-lambda-powertools/parser/middleware"
import errorLogger from "@middy/error-logger"
import { SqsRecordWithPayloadSchema } from "@sqsbench/schema"
import { batchItemFailures, sqsRecordNormalizer } from "@sqsbench/middleware"
import { Logger } from "@aws-lambda-powertools/logger"
import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware"
import { Milliseconds } from "./milliseconds.mjs"
import { AwsConsumerMetrics } from "./awsConsumerMetrics.mjs"
import { controller } from "./controller.mjs"
import { ConsumerEnvironment } from "./consumerEnvironment.mjs"
import { AwsConsumerLogger } from "./awsConsumerLogger.mjs"
import pLimit from "p-limit-esm"
import { logOnExit } from "./logOnExit.mjs"
import { nodeRelativeTimeout } from "./nodeRelativeTimeout.mjs"
import { Environment } from "./environment.mjs"

const metrics = new Metrics()
const logger = new Logger()

export const handler = middy()
  .use(injectLambdaContext(logger))
  .use(logMetrics(metrics))
  .use(errorLogger())
  .use(sqsRecordNormalizer())
  .use(batchItemFailures())
  .use(parser({
    schema: SqsRecordWithPayloadSchema.array().transform(records => records.map(record => record.body)),
  }))
  .handler(async (records) => {

      await using _ = logOnExit(logger)

    const env = new Environment<ConsumerEnvironment>(process.env)
    const perMessageDuration = env.get(ConsumerEnvironment.PerMessageDurationMs).default(50).as(v => v as Milliseconds)

    return controller({
      records,
      perMessageDuration,
      metrics: new AwsConsumerMetrics(metrics, env.get(ConsumerEnvironment.HighResMetrics).required().asBoolean()),
      logger: new AwsConsumerLogger(logger),
      timeoutAfter: nodeRelativeTimeout,
      atMostOneConcurrently: pLimit(1),
    })
  })

