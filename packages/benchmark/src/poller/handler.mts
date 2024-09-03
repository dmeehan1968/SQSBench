import { SQSClient } from "@aws-sdk/client-sqs"
import { LambdaClient } from "@aws-sdk/client-lambda"
import { Logger } from "@aws-lambda-powertools/logger"
import { SqsPollerController } from "./SqsPollerController.mjs"

const lambda = new LambdaClient()
const sqs = new SQSClient()
const logger = new Logger()

export const handler = new SqsPollerController(lambda, sqs, logger).handler


