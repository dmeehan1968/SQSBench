import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm"
import { Logger } from "@aws-lambda-powertools/logger"
import { ProducerState, ProducerStateSchema } from "./producerStateSchema.mjs"
import { JsonSchema } from "@sqsbench/schema"

interface StateFromParameterProps {
  parameterName: string
  ssm: SSMClient
  logger: Logger
}

export async function getStateFromParameter({
                                              parameterName,
                                              ssm,
                                              logger,
                                            }: StateFromParameterProps): Promise<ProducerState> {

  const res = await ssm.send(new GetParameterCommand({
    Name: parameterName,
  }))

  let state = ProducerStateSchema.parse(undefined)

  try {
    state = JsonSchema.pipe(ProducerStateSchema).parse(res.Parameter?.Value)
  } catch (error) {
    logger.error('Invalid parameter value, using default', {
      value: res.Parameter?.Value,
      error,
      default: state,
    })
  }

  return state

}