import { SQSClient } from "@aws-sdk/client-sqs"
import { LambdaClient } from "@aws-sdk/client-lambda"
import { Logger } from "@aws-lambda-powertools/logger"
import { SqsPollerController } from "./SqsPollerController.mjs"
import { Tracer } from "@aws-lambda-powertools/tracer"

const tracer = new Tracer()
const lambda = tracer.captureAWSv3Client(new LambdaClient())
const sqs = tracer.captureAWSv3Client(new SQSClient())
const logger = new Logger()

export const handler = new SqsPollerController(lambda, sqs, logger, tracer).handler


