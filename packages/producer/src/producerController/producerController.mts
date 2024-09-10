import { Logger } from "@aws-lambda-powertools/logger"
import { isIdlePhase } from "./isIdlePhase.mjs"
import { weightedMessageDistribution } from "../weightedMessageDistribution.mjs"
import { sendMessages } from "./sendMessages.mjs"
import { SqsProducerControllerSettings } from "@sqsbench/schema"
import { ProducerState } from "./producerStateSchema.mjs"

export interface Emitter {
  (delays: number[], queueUrl: string, currentTime: Date): Promise<any>
}

export interface ProducerControllerProps {
  settings: SqsProducerControllerSettings
  state: Required<ProducerState>
  currentTime: Date
  emitter: Emitter
  logger: Logger
}

export async function producerController({ settings, state, currentTime, logger, emitter }: ProducerControllerProps) {

  if (isIdlePhase({ ...state, ...settings, currentTime, logger })) {
    return
  }

  // Generate random delays for each message
  const delays = weightedMessageDistribution(state.rate, 60, settings.weightDistribution)

  logger.appendKeys({ delays })

  // Send messages to the emitter for each queue
  await sendMessages({
    currentTime,
    delays,
    queueUrls: settings.queueUrls,
    emitter,
    logger,
  })

}

