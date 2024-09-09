import { Logger } from "@aws-lambda-powertools/logger"
import { LambdaClient } from "@aws-sdk/client-lambda"
import { SSMClient } from "@aws-sdk/client-ssm"
import { Context } from "aws-lambda"
import { isIdlePhase } from "./isIdlePhase.mjs"
import { produceMessages } from "./produceMessages.mjs"
import { getCurrentTime } from "./getCurrentTime.mjs"
import { getState } from "./getState.mjs"
import { invokeEmitter } from "./invokeEmitter.mjs"
import { getSettingsFromEvent } from "./getSettingsFromEvent.mjs"

interface ProducerControllerProps {
  event: unknown
  context: Context
  logger: Logger
  ssm: SSMClient
  lambda: LambdaClient
}

export async function producerController({ event, logger, lambda, ssm }: ProducerControllerProps) {

  await using flushOnExit = { [Symbol.asyncDispose]: async () => logger.info('Done') }

  logger.appendKeys({ lambdaEvent: event })

  const settings = getSettingsFromEvent(event)
  const currentTime = getCurrentTime()
  const state = await getState({ ...settings, logger, ssm, currentTime })

  logger.appendKeys({ state })

  if (isIdlePhase({ ...state, ...settings, currentTime, logger })) {
    return
  }

  await produceMessages({
    ...state,
    ...settings,
    emit: (queueUrl, delays) => invokeEmitter({
      delays,
      queueUrl,
      emitterArn: settings.emitterArn,
      currentTime,
      lambda,
    }),
    logger,
  })

}

