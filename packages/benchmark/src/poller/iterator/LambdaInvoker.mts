import { Transforming } from './types.mjs'
import { InvokeCommand, InvokeCommandInput, LambdaClient } from '@aws-sdk/client-lambda'
import { z } from 'zod'
import { MultiSourceConsumer } from './MultiSourceConsumer.mjs'

export const LambdaInvocationResultSchema = z.object({
  req: z.unknown(),
  res: z.unknown().nullable(),
}).required()

export type LambdaInvocationResult = z.infer<typeof LambdaInvocationResultSchema>

export class LambdaInvoker implements Transforming<unknown, LambdaInvocationResult> {

  private multiSourceConsumer: MultiSourceConsumer<unknown, LambdaInvocationResult>

  constructor(
    private readonly client: LambdaClient,
    private readonly params: () => InvokeCommandInput,
  ) {
    this.multiSourceConsumer = new MultiSourceConsumer(value => this.invoke(value))
  }

  async consume(source: AsyncIterable<unknown>): Promise<void> {
    return this.multiSourceConsumer.consume(source)
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
    return this.multiSourceConsumer.generator()
  }
}