import { PutParameterCommand, SSMClient } from "@aws-sdk/client-ssm"
import { ProducerState } from "./producerStateSchema.mjs"

interface PutStateProps {
  parameterName: string
  rate: number
  rateChangeAt: Date
  ssm: SSMClient
}

export async function putState({ parameterName, rate, rateChangeAt, ssm }: PutStateProps) {
  return await ssm.send(new PutParameterCommand({
    Name: parameterName,
    Value: JSON.stringify({
      rate,
      rateChangeAt,
    } satisfies ProducerState),
    Overwrite: true,
  }))
}