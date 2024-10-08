export interface IdlePhaseLogger {
  (stats: { isIdlePhase: boolean, elapsedMinutes: number, rateDurationInMinutes: number, dutyCycle: number }): void
}

interface IdlePhaseProps {
  rate: number
  rateChangeAt: Date
  rateDurationInMinutes: number
  dutyCycle: number
  currentTime: Date
  logIdlePhaseStats: IdlePhaseLogger
}

export interface IdlePhaseCondition {
  (props: IdlePhaseProps): boolean
}

/**
 * Check if the producer is in an idle phase
 *
 * Idle phase is defined as:
 *
 * - The producer has been running for at least rateDurationInMinutes * dutyCycle minutes
 * - Or the rate is 0
 *
 * @param params The parameters for the idle phase
 * @param {number} params.rate The number of messages to produce per minute
 * @param {Date} params.rateChangeAt When the rate should next change
 * @param {number} params.rateDurationInMinutes How long the rate should be maintained
 * @param {number} params.dutyCycle The proportion of the rateDurationInMinutes that messages should be produced
 * @param {number} params.currentTime The time when the producer should start producing messages in this phase
 * @param {IdlePhaseLogger} params.logIdlePhaseStats A logger to log the stats of the idle phase
 */
export const isIdlePhase: IdlePhaseCondition = ({
  rate,
  rateChangeAt,
  rateDurationInMinutes,
  dutyCycle,
  currentTime,
  logIdlePhaseStats,
}: IdlePhaseProps) => {
  const commencedAt = rateChangeAt.getTime() - (rateDurationInMinutes * 60 * 1000)
  const elapsedMinutes = Math.floor((currentTime.getTime() - commencedAt) / 1000 / 60)

  const isIdlePhase = elapsedMinutes >= (rateDurationInMinutes * dutyCycle) || rate === 0

  logIdlePhaseStats({ isIdlePhase, elapsedMinutes, rateDurationInMinutes, dutyCycle })

  return isIdlePhase
}