import {
  DeleteMessageBatchCommand,
  Message,
  ReceiveMessageCommand,
  ReceiveMessageCommandInput,
  SQSClient,
} from "@aws-sdk/client-sqs"
import { EventEmitter } from "./EventEmitter.mjs"
import { chunkArray } from "@sqsbench/helpers"
import { Logger } from "@aws-lambda-powertools/logger"

interface QueueEvents {
  messages: Message[]
  stopped: void
  error: Error
}

type PollParams = Omit<ReceiveMessageCommandInput, 'QueueUrl'> & { MinNumberOfMessages?: number }

export class Queue extends EventEmitter<QueueEvents> {

  isPolling: boolean = false
  abortController: AbortController | null = null

  constructor(
    private readonly sqs: SQSClient,
    private readonly queueUrl: string,
    logger: Logger,
  ) {
    super(logger)
  }

  async poll(getParams: () => PollParams) {

    this.isPolling = true
    let shortBatchCount = 0
    let cumulativeMessages = 0
    let cumulativeTime = 0
    let cumulativeRequests = 0
    let canAbort = false

    while (this.isPolling) {

      const { MinNumberOfMessages, ...params } = getParams()

      this.logger.info(`Polling ${this.queueUrl.split('/').pop()}`, { params })

      this.abortController = new AbortController()

      const start = Date.now()
      const res = await this.sqs.send(new ReceiveMessageCommand({
        QueueUrl: this.queueUrl,
        MessageAttributeNames: ['All'],
        MessageSystemAttributeNames: ['All'],
        ...params,
      }), { abortSignal: this.abortController.signal })

      const elapsedTime = Date.now() - start
      const batchSize = params.MaxNumberOfMessages ?? 10
      cumulativeRequests++
      cumulativeTime += elapsedTime
      const messageCount = res.Messages?.length ?? 0
      cumulativeMessages += messageCount
      const batchSpeed = (messageCount / batchSize / (elapsedTime / 1000))
      const sessionSpeed = (cumulativeMessages / (cumulativeTime / 1000))
      canAbort = canAbort || messageCount < batchSize && elapsedTime > ((params.WaitTimeSeconds ?? 0) * 1000)
      this.logger.info(`[#${cumulativeRequests}] Received ${messageCount}/${params.MaxNumberOfMessages} messages in ${elapsedTime}ms, cumulative ${cumulativeTime}ms, ${cumulativeMessages} total, ${batchSpeed.toFixed(2)}/${sessionSpeed.toFixed(2)}${canAbort?'*':''} messages/s`)

      if (messageCount < (params.MaxNumberOfMessages ?? 10)) {
        shortBatchCount++
      } else {
        shortBatchCount = 0
      }

      if (!this.abortController.signal.aborted && res.Messages && messageCount > 0) {

        await this.emit('messages', [...res.Messages])

      }

      if (canAbort) {
        this.logger.info(`Stopping polling, low volume detected`)
        this.stop()
      }

      if ((res.Messages?.length ?? 0) < (MinNumberOfMessages ?? 1)) {
        this.logger.info('Stopping polling, empty receive encountered')
        this.stop()
      }

    }

    this.abortController = null
    await this.emit('stopped', undefined)
  }

  stop() {
    this.isPolling = false
  }

  abort() {
    this.abortController?.abort()
    this.stop()
  }

  [Symbol.dispose]() {
    this.abort()
  }

  async deleteMessages(messages: Message[]) {
    await Promise.allSettled(chunkArray(messages, 10).map(async chunk => {
      this.logger.debug(`Deleting ${chunk.length} messages from ${this.queueUrl}`)
      const res = await this.sqs.send(new DeleteMessageBatchCommand({
        QueueUrl: this.queueUrl,
        Entries: chunk.map(message => ({
          Id: message.MessageId,
          ReceiptHandle: message.ReceiptHandle,
        })),
      }))
      if (res.Failed) {
        this.logger.error('Failed to delete messages', { failed: res.Failed })
        await this.emit('error', new Error('Failed to delete messages'))
      }
    }))
  }
}