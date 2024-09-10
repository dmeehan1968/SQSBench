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

/**
 * Check if the producer is in an idle phase
 *
 * Idle phase is defined as:
 *
 * - The producer has been running for at least rateDurationInMinutes * dutyCycle minutes
 * - Or the rate is 0
 *
 * @param {number} rate The number of messages to produce per minute
 * @param {Date} rateChangeAt When the rate should next change
 * @param {number} rateDurationInMinutes How long the rate should be maintained
 * @param {number} dutyCycle The proportion of the rateDurationInMinutes that messages should be produced
 * @param {number} currentTime The time when the producer should start producing messages in this phase
 * @param {IdlePhaseLogger} logIdlePhaseStats A logger to log the stats of the idle phase
 */
export function isIdlePhase({
                              rate,
                              rateChangeAt,
                              rateDurationInMinutes,
                              dutyCycle,
                              currentTime,
                              logIdlePhaseStats,
                            }: IdlePhaseProps) {
  const commencedAt = rateChangeAt.getTime() - (rateDurationInMinutes * 60 * 1000)
  const elapsedMinutes = Math.floor((currentTime.getTime() - commencedAt) / 1000 / 60)

  const isIdlePhase = elapsedMinutes >= (rateDurationInMinutes * dutyCycle) || rate === 0

  logIdlePhaseStats({ isIdlePhase, elapsedMinutes, rateDurationInMinutes, dutyCycle })

  return isIdlePhase
}