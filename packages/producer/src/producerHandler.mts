import { SSMClient } from "@aws-sdk/client-ssm"
import { LambdaClient } from "@aws-sdk/client-lambda"
import { Logger } from "@aws-lambda-powertools/logger"
import middy from "@middy/core"
import errorLogger from "@middy/error-logger"
import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware"
import {
  Emitter,
  getCurrentTime,
  getSettingsFromEvent,
  getState, invokeEmitter,
  producerController,
} from "./producerController/index.mjs"

const logger = new Logger()
const ssm = new SSMClient()
const lambda = new LambdaClient()

async function _handler(event: unknown) {
  // noinspection JSUnusedLocalSymbols
    await using flushOnExit = { [Symbol.asyncDispose]: async () => logger.info('Done') }

  logger.appendKeys({ lambdaEvent: event })
  const settings = getSettingsFromEvent(event)
  const currentTime = getCurrentTime()
  const state = await getState({ ...settings, logger, ssm, currentTime })
  logger.appendKeys({ state })
  const emitter: Emitter = async (delays: number[], queueUrl: string, currentTime: Date) => {
    return invokeEmitter({ delays, queueUrl, emitterArn: settings.emitterArn, currentTime, lambda })
  }
  await producerController({
    settings, currentTime, state, logger, emitter
  })
}

export const handler = middy()
  .use(errorLogger({ logger: error => logger.error('Error', { error }) }))
  .use(injectLambdaContext(logger, { resetKeys: true }))
  .handler(_handler)

