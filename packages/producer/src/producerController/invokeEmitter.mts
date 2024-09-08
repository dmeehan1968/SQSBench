import { InvocationType, InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda"
import { SqsEmitterSettings } from "@sqsbench/schema"

interface InvokeEmitterProps {
  delays: number[]
  queueUrl: string
  emitterArn: string
  currentTime: Date
  lambda: LambdaClient
}

export async function invokeEmitter({ delays, queueUrl, emitterArn, currentTime, lambda }: InvokeEmitterProps) {
  const payload: SqsEmitterSettings = {
    queueUrl, delays, currentTime,
  }
  const response = await lambda.send(new InvokeCommand({
    FunctionName: emitterArn,
    InvocationType: InvocationType.Event,
    Payload: Buffer.from(JSON.stringify(payload)),
  }))
  if (response.StatusCode === undefined || response.StatusCode < 200 || response.StatusCode >= 300) {
    throw new Error('Lambda invocation failed', { cause: response })
  }
  return response
}