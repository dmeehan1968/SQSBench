import { Logger } from "@aws-lambda-powertools/logger"
import { LambdaClient } from "@aws-sdk/client-lambda"
import { chunkArray, splitSettledResults } from "@sqsbench/helpers"
import { invokeEmitter } from "./invokeEmitter.mjs"
import pLimit from "p-limit-esm"

interface SendMessagesProps {
  currentTime: Date,
  delays: number[],
  queueUrls: string[],
  emitterArn: string,
  lambda: LambdaClient,
  logger: Logger
}

export async function sendMessages({ currentTime, delays, queueUrls, emitterArn, lambda, logger }: SendMessagesProps) {
  // limit to 50 concurrent invocations (the lambda client connection limit)
  const limit = pLimit(50)

  // split the delays into chunks of 500 to distribute the load
  const pending = chunkArray(delays, 500)
    .flatMap(chunk =>
      queueUrls.map(queueUrl =>
        limit(() => invokeEmitter({
          delays: chunk,
          queueUrl,
          emitterArn,
          currentTime,
          lambda,
        })),
      ),
    )

  const { fulfilled, rejected } = splitSettledResults(await Promise.allSettled(pending))
  logger.appendKeys({
    emitterInvocations: fulfilled,
  })

  if (rejected.length > 0) {
    logger.error('Rejected emitter invocations', { rejected })
  }
}