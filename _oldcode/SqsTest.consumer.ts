import { Metrics, MetricUnit } from "@aws-lambda-powertools/metrics"
import middy from "@middy/core"
import { logMetrics } from "@aws-lambda-powertools/metrics/middleware"
import pLimit from "p-limit"
import { parser } from "@aws-lambda-powertools/parser/middleware"
import errorLogger from "@middy/error-logger"
import { SqsRecordWithPayloadSchema } from "@/infra/SqsTest/SqsRecordWithPayloadSchema"
import { sqsRecordNormalizer } from "@/infra/SqsTest/middleware/SqsRecordNormalizer"
import { batchItemFailures } from "@/infra/SqsTest/middleware/BatchItemFailures"

const metrics = new Metrics()

export const handler = middy()
  .use(logMetrics(metrics))
  .use(errorLogger())
  .use(sqsRecordNormalizer())
  .use(batchItemFailures())
  .use(parser({
    schema: SqsRecordWithPayloadSchema.array().transform(records => records.map(record => record.body))
  }))
  .handler(async (records) => {
    console.log('Event', JSON.stringify(records, null, 2))

    metrics.addMetric("MessagesReceived", MetricUnit.Count, records.length)

    const limit = pLimit(1)

    return Promise.allSettled(records.map(async () => limit(() => {
      return new Promise(resolve => setTimeout(resolve, 50))
    })))
  })

