import {
  DeleteMessageBatchCommand,
  Message,
  ReceiveMessageCommand,
  ReceiveMessageCommandInput,
  SQSClient,
} from "@aws-sdk/client-sqs"
import { EventEmitter } from "./EventEmitter"
import { chunkArray } from "@sqsbench/helpers"

const sqs = new SQSClient()

interface QueueEvents {
  messages: Message[]
  stopped: void
  error: Error
}

type PollParams = Omit<ReceiveMessageCommandInput, 'QueueUrl'> & { MinNumberOfMessages?: number }

export class Queue extends EventEmitter<QueueEvents> {

  isPolling: boolean = false
  abortController: AbortController | null = null

  constructor(private readonly queueUrl: string) {
    super()
  }

  async poll(getParams: () => PollParams) {

    this.isPolling = true

    while (this.isPolling) {

      const { MinNumberOfMessages, ...params } = getParams()

      console.log(`Polling ${this.queueUrl.split('/').pop()}`, params)

      this.abortController = new AbortController()

      const res = await sqs.send(new ReceiveMessageCommand({
        QueueUrl: this.queueUrl,
        MessageAttributeNames: ['All'],
        MessageSystemAttributeNames: ['All'],
        ...params,
      }), { abortSignal: this.abortController.signal })

      if (!this.abortController.signal.aborted && res.Messages && res.Messages.length > 0) {
        await this.emit('messages', [...res.Messages])
      }

      if (!this.isPolling || (res.Messages?.length ?? 0) < (MinNumberOfMessages ?? 1)) {
        console.log('Stopping polling, insufficient messages')
        break
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
      console.log(`Deleting ${chunk.length} messages from ${this.queueUrl}`)
      const res = await sqs.send(new DeleteMessageBatchCommand({
        QueueUrl: this.queueUrl,
        Entries: chunk.map(message => ({
          Id: message.MessageId,
          ReceiptHandle: message.ReceiptHandle,
        })),
      }))
      if (res.Failed) {
        console.error('Failed to delete messages', JSON.stringify(res.Failed))
        await this.emit('error', new Error('Failed to delete messages'))
      }
    }))
  }
}