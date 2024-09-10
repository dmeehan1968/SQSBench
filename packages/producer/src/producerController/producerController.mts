import { isIdlePhase, IdlePhaseLogger } from "./isIdlePhase.mjs"
import { weightedMessageDistribution } from "../weightedMessageDistribution.mjs"
import { EmitterErrorLogger, EmitterSuccessLogger, sendMessages } from "./sendMessages.mjs"
import { SqsProducerControllerSettings } from "@sqsbench/schema"
import { ProducerState } from "./producerStateSchema.mjs"

export interface Emitter {
  (delays: number[], queueUrl: string, currentTime: Date): Promise<any>
}

export interface DelaysLogger {
  (delays: number[]): void
}

export interface ProducerControllerProps {
  settings: SqsProducerControllerSettings
  state: Required<ProducerState>
  currentTime: Date
  emitter: Emitter
  logDelays: DelaysLogger
  logEmitterSuccesses: EmitterSuccessLogger
  logEmitterErrors: EmitterErrorLogger
  logIdlePhaseStats: IdlePhaseLogger
}

export async function producerController({ settings, state, currentTime, logDelays, logEmitterSuccesses, logEmitterErrors, logIdlePhaseStats, emitter }: ProducerControllerProps) {

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
    logEmitterErrors
  })

}

