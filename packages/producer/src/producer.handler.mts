import { SSMClient } from "@aws-sdk/client-ssm"
import { LambdaClient } from "@aws-sdk/client-lambda"
import { Logger } from "@aws-lambda-powertools/logger"
import { SqsProducerController } from "./SqsProducerController.mjs"

const ssm = new SSMClient()
const lambda = new LambdaClient()
const logger = new Logger()

export const handler = new SqsProducerController(ssm, lambda, logger).handler
