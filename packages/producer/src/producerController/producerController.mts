import { IdlePhaseLogger, IdlePhaseCondition } from "./isIdlePhase.mjs"
import { WeightedMessageDistribution } from "../weightedMessageDistribution.mjs"
import { EmitterErrorLogger, EmitterSuccessLogger, SendMessages } from "./sendMessages.mjs"
import { SqsProducerControllerSettings } from "@sqsbench/schema"
import { ProducerState } from "./producerStateSchema.mjs"

export interface MessageEmitter {
  (delays: number[], queueUrl: string, currentTime: Date): Promise<any>
}

export interface DelaysLogger {
  (delays: number[]): void
}

export interface ProducerControllerParams {
  settings: SqsProducerControllerSettings
  state: Required<ProducerState>
  currentTime: Date
}

export interface ProducerControllerDependencies {
  emitter: MessageEmitter
  logDelays: DelaysLogger
  logEmitterSuccesses: EmitterSuccessLogger
  logEmitterErrors: EmitterErrorLogger
  logIdlePhaseStats: IdlePhaseLogger
  isIdlePhase: IdlePhaseCondition
  weightedMessageDistribution: WeightedMessageDistribution
  sendMessages: SendMessages
}

export async function producerController({
  settings,
  state,
  currentTime,
}: ProducerControllerParams, {
  logDelays,
  logEmitterSuccesses,
  logEmitterErrors,
  logIdlePhaseStats,
  emitter,
  isIdlePhase,
  weightedMessageDistribution,
  sendMessages,
}: ProducerControllerDependencies) {

  if (isIdlePhase({ ...state, ...settings, currentTime, logIdlePhaseStats })) {
    return
  }

  // Generate random delays for each message
  const delays = weightedMessageDistribution(state.rate, 60, settings.weightDistribution)

  logDelays(delays)

  // Send messages to the emitter for each queue
  await sendMessages({
    currentTime,
    delays,
    queueUrls: settings.queueUrls,
    emitter,
    logEmitterSuccesses,
    logEmitterErrors,
  })

}

