import { Metrics, MetricUnit } from "@aws-lambda-powertools/metrics"
import middy from "@middy/core"
import { logMetrics } from "@aws-lambda-powertools/metrics/middleware"
import pLimit from "p-limit"
import { parser } from "@aws-lambda-powertools/parser/middleware"
import errorLogger from "@middy/error-logger"
import { SqsRecordWithPayloadSchema } from "@sqsbench/schema"
import { sqsRecordNormalizer } from "@sqsbench/middleware"
import { batchItemFailures } from "@sqsbench/middleware"
import { Logger } from "@aws-lambda-powertools/logger"
import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware"

const metrics = new Metrics()
const logger = new Logger()

export const handler = middy()
  .use(injectLambdaContext(logger))
  .use(logMetrics(metrics))
  .use(errorLogger())
  .use(sqsRecordNormalizer())
  .use(batchItemFailures())
  .use(parser({
    schema: SqsRecordWithPayloadSchema.array().transform(records => records.map(record => record.body))
  }))
  .handler(async (records) => {
    logger.info('Event', {
      event: records,
      PER_MESSAGE_DURATION: process.env.PER_MESSAGE_DURATION
    })

    metrics.addMetric("MessagesReceived", MetricUnit.Count, records.length)

    const limit = pLimit(1)
    const duration = parseInt(process.env.PER_MESSAGE_DURATION || '50')

    return Promise.allSettled(records.map(async () => limit(() => {
      return new Promise(resolve => setTimeout(resolve, duration))
    })))
  })

