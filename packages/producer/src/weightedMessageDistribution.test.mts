import { weightedMessageDistribution } from "./weightedMessageDistribution.mjs"

describe('weightedMessageDistribution', () => {

  it('should work', async () => {
    const messageCount = 3
    const duration = 60
    const weights: number[] = [1, 1, 1]

    const result = weightedMessageDistribution(messageCount, duration, weights)

    expect(result).toHaveLength(messageCount)
    expect(result[0]).toBeLessThanOrEqual(20)
    expect(result[1]).toBeGreaterThanOrEqual(20)
    expect(result[1]).toBeLessThanOrEqual(40)
    expect(result[2]).toBeGreaterThanOrEqual(40)
  })

  it('should bias towards higher weights when the message count is low', async () => {
    const messageCount = 1
    const duration = 60
    const weights: number[] = [1, 2, 1]

    const result = weightedMessageDistribution(messageCount, duration, weights)

    expect(result).toHaveLength(messageCount)
    expect(result[0]).toBeGreaterThanOrEqual(20)
    expect(result[0]).toBeLessThanOrEqual(40)
  })

  it('should bias towards earlier periods when the message count is low and weights are even', async () => {
    const messageCount = 2
    const duration = 60
    const weights: number[] = [1, 1, 1]

    const result = weightedMessageDistribution(messageCount, duration, weights)

    expect(result).toHaveLength(messageCount)
    expect(result[0]).toBeLessThanOrEqual(20)
    expect(result[1]).toBeGreaterThanOrEqual(20)
    expect(result[1]).toBeLessThanOrEqual(40)
  })
})