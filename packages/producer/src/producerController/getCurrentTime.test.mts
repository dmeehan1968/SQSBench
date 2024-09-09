import { getCurrentTime } from "./getCurrentTime.mjs"

describe('getCurrentTime', () => {

  // use fake timers
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2024-09-01T12:34:56.789Z') })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should align with top of minute', async () => {
    const now = new Date()
    const currentTime = getCurrentTime()

    // cannot be in the past
    expect(currentTime.getTime()).toBeGreaterThanOrEqual(now.getTime())

    // should still have same date and hour
    expect(currentTime.getDate()).toBe(now.getDate())
    expect(currentTime.getHours()).toBe(now.getHours())
    // should be at the next minute
    expect(currentTime.getMinutes()).toBe(now.getMinutes()+1)
    // should be at the top of the minute
    expect(currentTime.getSeconds()).toBe(0)
    expect(currentTime.getMilliseconds()).toBe(0)
  })
})