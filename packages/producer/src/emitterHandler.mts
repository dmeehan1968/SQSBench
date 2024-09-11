import { Logger } from "@aws-lambda-powertools/logger"
import { SendMessageBatchCommand, SQSClient } from "@aws-sdk/client-sqs"
import middy from "@middy/core"
import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware"
import errorLogger from "@middy/error-logger"
import { SqsEmitterSettingsSchema } from "@sqsbench/schema"
import { emitterController, MessageBatchSender } from "./emitterController/emitterController.mjs"

const sqs = new SQSClient()
const logger = new Logger()

async function _handler(unknown: unknown) {

  // noinspection JSUnusedLocalSymbols
    await using flushOnExit = { [Symbol.asyncDispose]: async () => logger.info('Done') }

  logger.appendKeys({ lambdaEvent: unknown })

  const { queueUrl, ...settings } = SqsEmitterSettingsSchema.parse(unknown)

  const queue: MessageBatchSender = {
    async sendMessageBatch(messages) {
      return sqs.send(new SendMessageBatchCommand({
        QueueUrl: queueUrl,
        Entries: messages.map((message, index) => ({
          Id: index.toString(),
          DelaySeconds: message.delay.toSeconds({ transform: Math.floor }),
          MessageBody: JSON.stringify(message.body),
        })),
      }))
    }
  }

  await emitterController({
    ...settings,
    maxConcurrency: 50,
    batchSize: 10,
  }, {
    queue,
    logMessageStats: stats => logger.info('Latencies (ms)', { latencies: stats }),
    logSendMessageError: error => logger.error('Batch Send Error', { error }),
  })
}

export const handler = middy()
  .use(errorLogger({ logger: error => logger.error('Error', { error }) }))
  .use(injectLambdaContext(logger))
  .handler(_handler)

