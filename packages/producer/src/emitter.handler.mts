import { Logger } from "@aws-lambda-powertools/logger"
import { SqsEmitterController } from "./SqsEmitterController.mjs"
import { SQSClient } from "@aws-sdk/client-sqs"

const sqs = new SQSClient()
const logger = new Logger()

export const handler = new SqsEmitterController(sqs, logger).handler
