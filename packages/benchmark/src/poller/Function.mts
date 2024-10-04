import { InvocationType, InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda"
import { EventEmitter } from "./EventEmitter.mjs"
import { Jsonifiable } from "./Jsonifiable.mjs"
import { Logger } from "@aws-lambda-powertools/logger"

interface FunctionEvents {
  response: { res: any, req: Jsonifiable }
  error: Error
}

export class Function extends EventEmitter<FunctionEvents> {

  constructor(
    private readonly lambda: LambdaClient,
    private readonly functionArn: string,
    logger: Logger,
    private readonly invocationType: InvocationType
  ) {
    super(logger)
  }

  async invoke(request: Jsonifiable) {
    this.logger.info(`Invoking ${this.functionArn}`)
    const res = await this.lambda.send(new InvokeCommand({
      FunctionName: this.functionArn,
      InvocationType: this.invocationType,
      Payload: Buffer.from(JSON.stringify(request)),
    }))

    if (res.FunctionError) {
      // if there is an error, ignore the messages and they will return to the queue
      this.logger.error('Error', { response: res })
      return
    }

    if (this.invocationType === InvocationType.RequestResponse) {
      const payload = res.Payload?.transformToString() ?? ''

      await this.emit('response', {
        res: payload.length ? JSON.parse(payload) : null,
        req: request,
      })
    }

  }
}