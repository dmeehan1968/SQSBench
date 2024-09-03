import { SSMClient } from "@aws-sdk/client-ssm"
import { SQSClient } from "@aws-sdk/client-sqs"
import { LambdaClient } from "@aws-sdk/client-lambda"
import { Logger } from "@aws-lambda-powertools/logger"
import { SqsProducerController } from "./SqsProducerController.mjs"

const ssm = new SSMClient()
const sqs = new SQSClient()
const lambda = new LambdaClient()
const logger = new Logger()

export const handler = new SqsProducerController(ssm, sqs, lambda, logger).handler
