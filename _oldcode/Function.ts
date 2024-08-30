import { InvocationType, InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda"
import { Jsonifiable } from "@/infra/SqsTest/Jsonifiable"
import { EventEmitter } from "@/infra/SqsTest/EventEmitter"

const lambda = new LambdaClient()

interface FunctionEvents {
  response: { res: any, req: Jsonifiable }
  error: Error
}

export class Function extends EventEmitter<FunctionEvents> {

  constructor(private readonly functionArn: string) {
    super()
  }

  async invoke(request: Jsonifiable) {
    console.log(`Invoking ${this.functionArn}`)
    const res = await lambda.send(new InvokeCommand({
      FunctionName: this.functionArn,
      InvocationType: InvocationType.RequestResponse,
      Payload: Buffer.from(JSON.stringify(request)),
    }))

    if (res.FunctionError) {
      // if there is an error, ignore the messages and they will return to the queue
      console.error('Error', res.FunctionError)
      return
    }

    await this.emit('response', {
      res: JSON.parse(res.Payload?.transformToString() ?? ''),
      req: request,
    })

  }
}