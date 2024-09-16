import { Duration, DurationError } from "./duration.mjs"

describe('Duration', () => {
  it('should be defined', () => {
    expect(Duration).toBeDefined()
  })

  it('should create from milliseconds', async () => {
    const duration = Duration.milliseconds(1000)
    expect(duration.toMilliseconds()).toEqual(1000)
  })

  it('should create from seconds', async () => {
    const duration = Duration.seconds(1)
    expect(duration.toMilliseconds()).toEqual(1000)
  })

  it('should create from minutes', async () => {
    const duration = Duration.minutes(1)
    expect(duration.toMilliseconds()).toEqual(60000)
  })

  it('should create from hours', async () => {
    const duration = Duration.hours(1)
    expect(duration.toMilliseconds()).toEqual(3600000)
  })

  it('should create from days', async () => {
    const duration = Duration.days(1)
    expect(duration.toMilliseconds()).toEqual(86400000)
  })

  it('should parse milliseconds', async () => {
    const duration = Duration.parse(1000)
    expect(duration.toMilliseconds()).toEqual(1000)
  })

  describe('should parse ISO 8601 durations', () => {

    it('should parse fractional seconds', async () => {
      const duration = Duration.parse('PT0.001S')
      expect(duration.toMilliseconds()).toEqual(1)
    })

    it('should parse seconds', async () => {
      const duration = Duration.parse('PT1S')
      expect(duration.toMilliseconds()).toEqual(1000)
    })

    it('should parse fractional minutes', async () => {
      const duration = Duration.parse('PT0.1M')
      expect(duration.toSeconds()).toEqual(6)
    })

    it('should parse minutes', async () => {
      const duration = Duration.parse('PT1M')
      expect(duration.toMilliseconds()).toEqual(60000)
    })

    it('should parse fractional hours', async () => {
      const duration = Duration.parse('PT0.1H')
      expect(duration.toMinutes()).toEqual(6)
    })

    it('should parse hours', async () => {
      const duration = Duration.parse('PT1H')
      expect(duration.toMilliseconds()).toEqual(3600000)
    })

    it('should parse fractional days', async () => {
      const duration = Duration.parse('P0.5D')
      expect(duration.toHours()).toEqual(12)
    })

    it('should parse days', async () => {
      const duration = Duration.parse('P1D')
      expect(duration.toMilliseconds()).toEqual(86400000)
    })

    it('should parse complex duration', async () => {
      const duration = Duration.parse('P1DT1H1M1.001S')
      expect(duration.toMilliseconds()).toEqual(90061001)
    })

    it('should parse large values', async () => {
      const duration = Duration.parse('PT86400000S')
      expect(duration.toSeconds()).toEqual(86400000)
      expect(duration.toMilliseconds()).toEqual(86400000000)
    })

    it('should throw on invalid', async () => {
      expect(() => Duration.parse('P1Y')).toThrow(DurationError)
      expect(() => Duration.parse('PT1Y')).toThrow(DurationError)
      expect(() => Duration.parse('P1X')).toThrow(DurationError)
      expect(() => Duration.parse('P1D ')).toThrow(DurationError)
      expect(() => Duration.parse(' P1D')).toThrow(DurationError)
    })
  })

  describe('integral handling', () => {

    it('should handle integral values', async () => {
      const duration = Duration.milliseconds(1000)
      expect(duration.toSeconds()).toEqual(1)
    })

    it('should throw on fractional values by default', async () => {
      expect(() => Duration.milliseconds(1500).toSeconds()).toThrow(DurationError)
      expect(() => Duration.seconds(30).toMinutes()).toThrow(DurationError)
      expect(() => Duration.minutes(30).toHours()).toThrow(DurationError)
      expect(() => Duration.hours(12).toDays()).toThrow(DurationError)
    })

    it('should not throw on fractional values when disabled', async () => {
      expect(Duration.milliseconds(1500).toSeconds({ integral: false })).toEqual(1.5)
      expect(Duration.seconds(30).toMinutes({ integral: false })).toEqual(0.5)
      expect(Duration.minutes(30).toHours({ integral: false })).toEqual(0.5)
      expect(Duration.hours(12).toDays({ integral: false })).toEqual(0.5)
    })
  })

  describe('transforms', () => {

      it('should apply transform', async () => {
        const spy = jest.fn()
        spy.mockReturnValue(1)

        const duration = Duration.milliseconds(1500)
        expect(duration.toSeconds({ transform: spy })).toEqual(1)
        expect(spy).toHaveBeenCalledWith(1.5)
      })

      it('should apply transform and integral check', async () => {
        const spy = jest.fn()
        spy.mockReturnValue(1.2)
        expect(() => Duration.milliseconds(1500).toSeconds({ transform: spy })).toThrow(DurationError)
      })

    it('should work with floor', async () => {
      const duration = Duration.milliseconds(1500)
      expect(duration.toSeconds({ transform: Math.floor })).toEqual(1)
    })

    it('should work with ceil', async () => {
      const duration = Duration.milliseconds(1500)
      expect(duration.toSeconds({ transform: Math.ceil })).toEqual(2)
    })

    it('should work with round', async () => {
      const duration = Duration.milliseconds(1500)
      expect(duration.toSeconds({ transform: Math.round })).toEqual(2)
    })
  })

  describe('toIsoString', () => {

    it('should format fractional seconds', async () => {
      expect(Duration.milliseconds(1).toIsoString()).toEqual('PT0.001S')
      expect(Duration.milliseconds(500).toIsoString()).toEqual('PT0.5S')
      expect(Duration.milliseconds(1001).toIsoString()).toEqual('PT1.001S')
      expect(Duration.milliseconds(1500).toIsoString()).toEqual('PT1.5S')
    })

    it('should format seconds', async () => {
      expect(Duration.milliseconds(1000).toIsoString()).toEqual('PT1S')
      expect(Duration.milliseconds(30000).toIsoString()).toEqual('PT30S')
    })

    it('should format fractional minutes', async () => {
      expect(Duration.milliseconds(90000).toIsoString()).toEqual('PT1M30S')
    })

    it('should format minutes', async () => {
      expect(Duration.milliseconds(60000).toIsoString()).toEqual('PT1M')
    })

    it('should format fractional hours', async () => {
      expect(Duration.milliseconds(5400000).toIsoString()).toEqual('PT1H30M')
    })

    it('should format hours', async () => {
      expect(Duration.milliseconds(3600000).toIsoString()).toEqual('PT1H')
    })

    it('should format fractional days', async () => {
      expect(Duration.milliseconds(129600000).toIsoString()).toEqual('P1DT12H')
    })

    it('should format days', async () => {
      expect(Duration.milliseconds(86400000).toIsoString()).toEqual('P1D')
    })

    it('should format complex duration', async () => {
      expect(Duration.milliseconds(90061001).toIsoString()).toEqual('P1DT1H1M1.001S')
    })

    it('should format a zero duration as seconds regardless of origin', async () => {
      expect(Duration.milliseconds(0).toIsoString()).toEqual('PT0S')
      expect(Duration.seconds(0).toIsoString()).toEqual('PT0S')
      expect(Duration.minutes(0).toIsoString()).toEqual('PT0S')
      expect(Duration.hours(0).toIsoString()).toEqual('PT0S')
      expect(Duration.days(0).toIsoString()).toEqual('PT0S')
    })
  })
})