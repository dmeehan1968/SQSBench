import { ProducerState } from "./producerStateSchema.mjs"
import { getStateFromParameter } from "./getStateFromParameter.mjs"
import { putState } from "./putState.mjs"
import { Logger } from "@aws-lambda-powertools/logger"
import { SSMClient } from "@aws-sdk/client-ssm"

interface GetStateProps {
  parameterName: string
  minRate: number
  maxRate: number
  rateScaleFactor: number
  rateDurationInMinutes: number
  currentTime: Date
  logger: Logger
  ssm: SSMClient
}

export async function getState({
                                 parameterName, minRate,
                                 maxRate,
                                 rateScaleFactor,
                                 rateDurationInMinutes,
                                 currentTime,
                                 logger,
                                 ssm,
                               }: GetStateProps): Promise<Required<ProducerState>> {

  let state = await getStateFromParameter({ parameterName: parameterName, ssm: ssm, logger: logger })

  let { rate, rateChangeAt } = state

  if (rateChangeAt === undefined || currentTime >= rateChangeAt) {
    if (rateChangeAt !== undefined) {
      rate = rate === 0
        ? minRate
        : rate < maxRate
          ? rate * rateScaleFactor
          : 0
    }

    rateChangeAt = new Date(currentTime)
    if (rate === 0) {
      rateChangeAt.setHours(rateChangeAt.getHours() + 1, 0, 0, 0)
    } else {
      rateChangeAt.setMinutes(rateDurationInMinutes, 0, 0)
    }
    const response = await putState({ parameterName, rate, rateChangeAt, ssm })

    logger.appendKeys({ putParameterResponse: response })
  }

  return { rate, rateChangeAt }
}