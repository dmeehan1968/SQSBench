import { PollerPropsSchema } from '@sqsbench/schema'
import { SQSClient } from '@aws-sdk/client-sqs'
import { LambdaClient } from '@aws-sdk/client-lambda'
import { Poller } from './Poller.mjs'
import { Tracer } from '@aws-lambda-powertools/tracer'
import middy from '@middy/core'
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware'

const tracer = new Tracer()
const sqs = tracer.captureAWSv3Client(new SQSClient())
const lambda = tracer.captureAWSv3Client(new LambdaClient())

export const handler = middy()
  .use(captureLambdaHandler(tracer))
  .handler(async (unknown: unknown) => {
    const params = PollerPropsSchema.parse(unknown)
    await new Poller(lambda, sqs, params)
      .poll()
  })