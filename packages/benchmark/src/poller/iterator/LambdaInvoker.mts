import { Transforming } from './types.mjs'
import { InvokeCommand, InvokeCommandInput, LambdaClient } from '@aws-sdk/client-lambda'
import { z } from 'zod'

export const LambdaInvocationResultSchema = z.object({
  req: z.unknown(),
  res: z.unknown().nullable(),
}).required()

export type LambdaInvocationResult = z.infer<typeof LambdaInvocationResultSchema>

export class LambdaInvoker implements Transforming<unknown, LambdaInvocationResult> {

  private source: AsyncIterable<unknown> | undefined
  private completions = new Set<() => void>()

  constructor(
    private readonly client: LambdaClient,
    private readonly params: () => InvokeCommandInput,
  ) {
  }

  async consume(source: AsyncIterable<unknown>): Promise<void> {
    this.source = source
    return new Promise<void>(resolve => this.completions.add(resolve))
  }

  private async* generator() {
    try {

      if (!this.source) {
        throw new Error('No source')
      }

      for await (const requestPayload of this.source) {
        yield await this.invoke(requestPayload)
      }

    } finally {
        for (const completion of this.completions) {
          completion()
        }
        this.completions.clear()
    }
  }

  async invoke(requestPayload: unknown) {
    const params = this.params()
    const res = await this.client.send(new InvokeCommand({
      Payload: JSON.stringify(requestPayload),
      ...params,
    }))

    const responsePayload = res.Payload?.transformToString() ?? ''
    return LambdaInvocationResultSchema.parse({
      req: requestPayload,
      res: responsePayload.length ? JSON.parse(responsePayload) : null
    })
  }

  [Symbol.asyncIterator]() {
    return this.generator()
  }
}