import { chunkArray, splitSettledResults } from "@sqsbench/helpers"
import pLimit from "p-limit-esm"
import { MessageEmitter } from "./producerController.mjs"

export interface EmitterSuccessLogger {
  (results: any[]): void
}

export interface EmitterErrorLogger {
  (errors: Error[]): void
}

interface SendMessagesProps {
  currentTime: Date,
  delays: number[],
  queueUrls: string[],
  emitter: MessageEmitter
  logEmitterSuccesses: EmitterSuccessLogger
  logEmitterErrors: EmitterErrorLogger
}

export interface SendMessages {
  (props: SendMessagesProps): Promise<void>
}

export const sendMessages: SendMessages = async ({
  currentTime,
  delays,
  queueUrls,
  emitter,
  logEmitterSuccesses,
  logEmitterErrors,
}: SendMessagesProps) => {
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

  logEmitterSuccesses(fulfilled)

  if (rejected.length > 0) {
    logEmitterErrors(rejected)
  }
}