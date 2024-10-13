import { Acquired, Producing } from './types.mjs'
import { Message, ReceiveMessageCommand, ReceiveMessageCommandInput, SQSClient } from '@aws-sdk/client-sqs'
import { Duration } from '@sqsbench/helpers'

export class SqsMessageProducer implements Producing<Acquired<Message[]>> {

  constructor(
    private readonly client: SQSClient,
    private readonly abort: AbortSignal,
    private readonly params: () => ReceiveMessageCommandInput,
  ) {
  }

  private async* generator() {

    while (!this.abort.aborted) {

      const start = Date.now()

      const res = await this.client.send(
        new ReceiveMessageCommand(this.params()), {
          abortSignal: this.abort,
        },
      )

      if (res.Messages && res.Messages.length) {
        yield {
          data: res.Messages,
          acquiredIn: Duration.milliseconds(Date.now() - start),
        }
      }

    }

  }

  [Symbol.asyncIterator]() {
    return this.generator()
  }
}