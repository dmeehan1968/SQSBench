import { mockFn } from 'jest-mock-extended'
import { isIdlePhase, IdlePhaseLogger } from "./isIdlePhase.mjs"

describe("isIdlePhase", () => {
  let mockLogIdlePhaseStats = mockFn<IdlePhaseLogger>()

  it.each([
    { rate: 0, elapsedMinutes: 0, rateDurationInMinutes: 60, dutyCycle: 0.5, isIdle: true },
    { rate: 10, elapsedMinutes: 0, rateDurationInMinutes: 60, dutyCycle: 0.5, isIdle: false },
    { rate: 10, elapsedMinutes: 5, rateDurationInMinutes: 60, dutyCycle: 0.5, isIdle: false },
    { rate: 10, elapsedMinutes: 29, rateDurationInMinutes: 60, dutyCycle: 0.5, isIdle: false },
    { rate: 10, elapsedMinutes: 30, rateDurationInMinutes: 60, dutyCycle: 0.5, isIdle: true },
    { rate: 10, elapsedMinutes: 59, rateDurationInMinutes: 60, dutyCycle: 1, isIdle: false },
    { rate: 10, elapsedMinutes: 60, rateDurationInMinutes: 60, dutyCycle: 1, isIdle: true },
    { rate: 10, elapsedMinutes: 31, rateDurationInMinutes: 60, dutyCycle: 0.5, isIdle: true },
  ])(
    "should return $isIdle if rate=$rate, elapsed minutes=$elapsedMinutes and rateDurationInMinutes * dutyCycle ($rateDurationInMinutes * $dutyCycle)",
    ({ rate, elapsedMinutes, rateDurationInMinutes, dutyCycle, isIdle }) => {

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
        logIdlePhaseStats: mockLogIdlePhaseStats,
      })

      // Assert
      expect(result).toBe(isIdle)
      expect(mockLogIdlePhaseStats).toHaveBeenCalledWith({
        isIdlePhase: isIdle,
        elapsedMinutes,
        rateDurationInMinutes,
        dutyCycle
      })
    })
})