import { Logger } from "@aws-lambda-powertools/logger"
import { LambdaClient } from "@aws-sdk/client-lambda"
import { SSMClient } from "@aws-sdk/client-ssm"
import { Context } from "aws-lambda"
import { isIdlePhase } from "./isIdlePhase.mjs"
import { getCurrentTime } from "./getCurrentTime.mjs"
import { getState } from "./getState.mjs"
import { getSettingsFromEvent } from "./getSettingsFromEvent.mjs"
import { weightedMessageDistribution } from "../weightedMessageDistribution.mjs"
import { sendMessages } from "./sendMessages.mjs"

interface ProducerControllerProps {
  event: unknown
  logger: Logger
  ssm: SSMClient
  lambda: LambdaClient
}

export async function producerController({ event, logger, lambda, ssm }: ProducerControllerProps) {

  // noinspection JSUnusedLocalSymbols
    await using flushOnExit = { [Symbol.asyncDispose]: async () => logger.info('Done') }

  logger.appendKeys({ lambdaEvent: event })

  const settings = getSettingsFromEvent(event)
  const currentTime = getCurrentTime()
  const state = await getState({ ...settings, logger, ssm, currentTime })

  logger.appendKeys({ state })

  if (isIdlePhase({ ...state, ...settings, currentTime, logger })) {
    return
  }

  // Generate random delays for each message
  const delays = weightedMessageDistribution(state.rate, 60, settings.weightDistribution)

  logger.appendKeys({ delays })

  await sendMessages({
    currentTime,
    delays,
    queueUrls: settings.queueUrls,
    emitterArn: settings.emitterArn,
    lambda,
    logger,
  })

}

