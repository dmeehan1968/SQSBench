import { Logger } from "@aws-lambda-powertools/logger"
import { chunkArray, splitSettledResults } from "@sqsbench/helpers"
import pLimit from "p-limit-esm"
import { Emitter } from "./producerController.mjs"

interface SendMessagesProps {
  currentTime: Date,
  delays: number[],
  queueUrls: string[],
  emitter: Emitter
  logger: Logger
}

export async function sendMessages({ currentTime, delays, queueUrls, emitter, logger }: SendMessagesProps) {
  // limit to 50 concurrent invocations (the lambda client connection limit)
  const limit = pLimit(50)

  // split the delays into chunks of 500 to distribute the load
  const pending = chunkArray(delays, 500)
    .flatMap(chunk =>
      queueUrls.map(queueUrl =>
        limit(() => emitter(chunk, queueUrl, currentTime)),
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