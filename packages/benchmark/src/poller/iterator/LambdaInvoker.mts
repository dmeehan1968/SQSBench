import { Consuming, Producing } from './types.mjs'
import { InvokeCommand, InvokeCommandInput, LambdaClient } from '@aws-sdk/client-lambda'

export interface LambdaInvocationResult<T, U> {
  req: T
  res: U | null
}

export class LambdaInvoker implements Consuming<any>, Producing<any> {

  private source: AsyncIterable<any> | undefined
  private completions = new Set<() => void>()

  constructor(
    private readonly client: LambdaClient,
    private readonly params: () => InvokeCommandInput,
  ) {
  }

  async consume(source: AsyncIterable<any>): Promise<void> {
    this.source = source
    return new Promise<void>(resolve => this.completions.add(resolve))
  }

  private async* generator() {
    try {

      if (!this.source) {
        throw new Error('No source')
      }

      for await (const requestPayload of this.source) {
        const params = this.params()
        const res = await this.client.send(new InvokeCommand({
          Payload: JSON.stringify(requestPayload),
          ...params,
        }))

        const responsePayload = res.Payload?.transformToString() ?? ''
        yield {
          req: requestPayload,
          res: responsePayload.length ? JSON.parse(responsePayload) : null
        }
      }

    } finally {

        for (const completion of this.completions) {
          completion()
        }
    }
  }

  [Symbol.asyncIterator]() {
    return this.generator()
  }
}