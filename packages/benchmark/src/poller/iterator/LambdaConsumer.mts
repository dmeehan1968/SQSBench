import { Consuming } from './types.mjs'
import { Message } from '@aws-sdk/client-sqs'
import { InvocationType, InvokeCommand, InvokeCommandInput, LambdaClient } from '@aws-sdk/client-lambda'

export class LambdaConsumer implements Consuming<Message[]> {

  constructor(
    private readonly client: LambdaClient,
    private readonly params: () => InvokeCommandInput,
  ) {
  }

  async consume(source: AsyncIterable<Message[]>): Promise<void> {
    for await (const messages of source) {
      await this.client.send(new InvokeCommand({
        Payload: JSON.stringify({ messages }),
        InvocationType: InvocationType.Event,
        ...this.params(),
      }))
    }
  }
}