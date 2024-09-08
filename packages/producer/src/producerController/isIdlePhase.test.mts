import { Logger } from "@aws-lambda-powertools/logger"
import { mock } from 'jest-mock-extended'
import { isIdlePhase } from "./isIdlePhase.mjs"

describe("isIdlePhase", () => {
  let logger: Logger

  beforeEach(() => {
    logger = mock<Logger>()
  })

  it.each([
    { rate: 0, elapsedMinutes: 0, rateDurationInMinutes: 60, dutyCycle: 0.5, expected: true },
    { rate: 10, elapsedMinutes: 0, rateDurationInMinutes: 60, dutyCycle: 0.5, expected: false },
    { rate: 10, elapsedMinutes: 5, rateDurationInMinutes: 60, dutyCycle: 0.5, expected: false },
    { rate: 10, elapsedMinutes: 29, rateDurationInMinutes: 60, dutyCycle: 0.5, expected: false },
    { rate: 10, elapsedMinutes: 30, rateDurationInMinutes: 60, dutyCycle: 0.5, expected: true },
    { rate: 10, elapsedMinutes: 59, rateDurationInMinutes: 60, dutyCycle: 1, expected: false },
    { rate: 10, elapsedMinutes: 60, rateDurationInMinutes: 60, dutyCycle: 1, expected: true },
    { rate: 10, elapsedMinutes: 31, rateDurationInMinutes: 60, dutyCycle: 0.5, expected: true },
  ])(
    "should return $expected if rate=$rate, elapsed minutes=$elapsedMinutes and rateDurationInMinutes * dutyCycle ($rateDurationInMinutes * $dutyCycle)",
    ({ rate, elapsedMinutes, rateDurationInMinutes, dutyCycle, expected }) => {

      // Arrange
      const currentTime = new Date()
      const startTime = new Date(currentTime)
      startTime.setMinutes(startTime.getMinutes() - elapsedMinutes, 0, 0)
      const rateChangeAt = new Date(startTime)
      rateChangeAt.setMinutes(rateChangeAt.getMinutes() + rateDurationInMinutes, 0, 0)

      // Act
      const result = isIdlePhase({
        rateChangeAt,
        currentTime,
        rate,
        rateDurationInMinutes,
        dutyCycle,
        logger,
      })

      // Assert
      expect(result).toBe(expected)
      expect(logger.appendKeys).toHaveBeenCalledWith({
        isIdlePhase: expected,
        elapsedMinutes,
        rateDurationInMinutes,
        dutyCycle
      })
    })
})