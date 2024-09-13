import { Logger } from "@aws-lambda-powertools/logger"

export function logOnExit(logger: Logger) {
  return {
    async [Symbol.asyncDispose]() {
      logger.info('Done')
    },
  }
}