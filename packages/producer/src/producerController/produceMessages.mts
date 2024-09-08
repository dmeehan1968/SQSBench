import { Logger } from "@aws-lambda-powertools/logger"
import { weightedMessageDistribution } from "../weightedMessageDistribution.mjs"
import pLimit from "p-limit-esm"
import { chunkArray, splitSettledResults } from "@sqsbench/helpers"

interface SendMessagesProps {
  rate: number
  weightDistribution: number[]
  queueUrls: string[]
  emit: { (queueUrl: string, chunk: number[]): Promise<any> }
  logger: Logger
}

export async function produceMessages({
                                     rate,
                                     weightDistribution,
                                     queueUrls,
                                     emit,
                                     logger,
                                   }: SendMessagesProps): Promise<void> {

  // Generate random delays for each message
  const delays = weightedMessageDistribution(rate, 60, weightDistribution)
  logger.appendKeys({ delays })

  // limit concurrency to 50, same as lambda client connection limit
  const limit = pLimit(50)

  // Send 500 delays to each emitter invocation (which results in 50 batch sends of 10 messages each)
  const pending = chunkArray(delays, 500)
    .flatMap(chunk =>
      queueUrls.map(queueUrl =>
        limit(() => emit(queueUrl, chunk)),
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