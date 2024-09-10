import { SSMClient } from "@aws-sdk/client-ssm"
import { LambdaClient } from "@aws-sdk/client-lambda"
import { Logger } from "@aws-lambda-powertools/logger"
import middy from "@middy/core"
import errorLogger from "@middy/error-logger"
import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware"
import { producerController } from "./producerController/index.mjs"

const logger = new Logger()
const ssm = new SSMClient()
const lambda = new LambdaClient()

export const handler = middy()
  .use(errorLogger({ logger: error => logger.error('Error', { error }) }))
  .use(injectLambdaContext(logger, { resetKeys: true }))
  .handler(event => producerController({ event, logger, ssm, lambda }))

