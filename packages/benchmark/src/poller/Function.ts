import { InvocationType, InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda"
import { EventEmitter } from "./EventEmitter"
import { Jsonifiable } from "./Jsonifiable"
import { Logger } from "@aws-lambda-powertools/logger"

interface FunctionEvents {
  response: { res: any, req: Jsonifiable }
  error: Error
}

export class Function extends EventEmitter<FunctionEvents> {

  constructor(
    private readonly lambda: LambdaClient,
    private readonly functionArn: string,
    private readonly logger: Logger,
  ) {
    super()
  }

  async invoke(request: Jsonifiable) {
    this.logger.info(`Invoking ${this.functionArn}`)
    const res = await this.lambda.send(new InvokeCommand({
      FunctionName: this.functionArn,
      InvocationType: InvocationType.RequestResponse,
      Payload: Buffer.from(JSON.stringify(request)),
    }))

    if (res.FunctionError) {
      // if there is an error, ignore the messages and they will return to the queue
      this.logger.error('Error', { response: res })
      return
    }

    await this.emit('response', {
      res: JSON.parse(res.Payload?.transformToString() ?? ''),
      req: request,
    })

  }
}