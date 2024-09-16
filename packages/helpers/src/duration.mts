/**
 * A type representing milliseconds.
 *
 * @type {Milliseconds}
 */
export type Milliseconds = number & { __milliseconds: never }
/**
 * A type representing seconds.
 *
 * @type {Seconds}
 */
export type Seconds = number & { __seconds: never }
/**
 * A type representing minutes.
 *
 * @type {Minutes}
 */
export type Minutes = number & { __minutes: never }
/**
 * A type representing hours.
 *
 * @type {Hours}
 */
export type Hours = number & { __hours: never }
/**
 * A type representing days.
 *
 * @type {Days}
 */
export type Days = number & { __days: never }

/**
 * A type representing a time unit.
 *
 * @type {TimeUnit}
 */
export class TimeUnit {
  static readonly Milliseconds = new TimeUnit('Milliseconds', '', 1)
  static readonly Seconds = new TimeUnit('Seconds', 's', 1000)
  static readonly Minutes = new TimeUnit('Minutes', 'm', 1000 * 60)
  static readonly Hours = new TimeUnit('Hours', 'h', 1000 * 60 * 60)
  static readonly Days = new TimeUnit('Days', 'd', 1000 * 60 * 60 * 24)

  constructor(public readonly label: string, public readonly isoLabel: string, public readonly inMilliseconds: number) {
  }

  toString() {
    return this.label
  }
}

/**
 * An error class for duration errors.
 *
 */
export class DurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

export interface ConversionOptions {
  integral?: boolean
  transform?: (value: number) => number
}

export class Duration {
  constructor(private readonly value: number, private readonly unit: TimeUnit) {
  }

  static milliseconds(milliseconds: number) {
    return new Duration(milliseconds, TimeUnit.Milliseconds)
  }

  static seconds(seconds: number) {
    return new Duration(seconds, TimeUnit.Seconds)
  }

  static minutes(minutes: number) {
    return new Duration(minutes, TimeUnit.Minutes)
  }

  static hours(hours: number) {
    return new Duration(hours, TimeUnit.Hours)
  }

  static days(days: number) {
    return new Duration(days, TimeUnit.Days)
  }

  /**
   * Parse a duration string or number.
   *
   * If number, it is assumed to be in milliseconds.
   *
   * If string, it is parsed as an ISO 8601 duration string, up to the resolution of days. Duration parts
   * can be specified as integer or decimal numbers.
   *
   * Negative durations are not supported.
   *
   * @param {string | number} duration
   * @returns {Duration}
   * @throws {DurationError} if the input is not a valid duration
   */
  static parse(duration: string | number): Duration {
    if (typeof duration === 'number') {
      return Duration.milliseconds(duration)
    }

    // create a regex with named capture groups for each part of the duration
    const durationRegex = /^P(?:(?<days>\d+(?:\.\d+)?)D)?(T(?:(?<hours>\d+(?:\.\d+)?)H)?(?:(?<minutes>\d+(?:\.\d+)?)M)?(?:(?<seconds>\d+(?:\.\d+)?)S)?)?$/

    // match the input string against the regex
    const match = duration.match(durationRegex)

    // if no match, throw an error
    if (!match) {
      throw new DurationError(`Invalid duration string: '${duration}'`)
    }

    // extract the named capture groups
    const days = match.groups?.days ? parseFloat(match.groups.days) : 0
    const hours = match.groups?.hours ? parseFloat(match.groups.hours) : 0
    const minutes = match.groups?.minutes ? parseFloat(match.groups.minutes) : 0
    const seconds = match.groups?.seconds ? parseFloat(match.groups.seconds) : 0

    // calculate the total duration in milliseconds
    const totalMilliseconds =
      (days * TimeUnit.Days.inMilliseconds) +
      (hours * TimeUnit.Hours.inMilliseconds) +
      (minutes * TimeUnit.Minutes.inMilliseconds) +
      (seconds * TimeUnit.Seconds.inMilliseconds)

    return Duration.milliseconds(totalMilliseconds)
  }

  private to(targetUnit: TimeUnit, options?: ConversionOptions): number {

    let result = this.value * this.unit.inMilliseconds / targetUnit.inMilliseconds

    if (options?.transform) {
      result = options.transform(result)
    }

    if (options?.integral ?? true) {
      if (result % 1 !== 0) {
        throw new DurationError(`Cannot convert ${this.unit} to ${targetUnit} without loss of precision`)
      }
    }
    return result
  }

  toMilliseconds(options?: ConversionOptions): Milliseconds {
    return this.to(TimeUnit.Milliseconds, options) as Milliseconds
  }

  toSeconds(options?: ConversionOptions): Seconds {
    return this.to(TimeUnit.Seconds, options) as Seconds
  }

  toMinutes(options?: ConversionOptions): Minutes {
    return this.to(TimeUnit.Minutes, options) as Minutes
  }

  toHours(options?: ConversionOptions): Hours {
    return this.to(TimeUnit.Hours, options) as Hours
  }

  toDays(options?: ConversionOptions): Days {
    return this.to(TimeUnit.Days, options) as Days
  }

  toIsoString(): string {
    const dateParts: string[] = []
    const timeParts: string[] = []

    let remainder: number = this.toMilliseconds()

    if (remainder === 0) {
      return 'PT0S'
    }

    const units = [
      { unit: TimeUnit.Days, destination: dateParts, isoLabel: 'D', floor: true },
      { unit: TimeUnit.Hours, destination: timeParts, isoLabel: 'H', floor: true },
      { unit: TimeUnit.Minutes, destination: timeParts, isoLabel: 'M', floor: true },
      { unit: TimeUnit.Seconds, destination: timeParts, isoLabel: 'S', floor: false },
    ]

    for (const { unit, destination, isoLabel, floor } of units) {
      let value = remainder / unit.inMilliseconds

      value = floor ? Math.floor(value) : value

      remainder -= value * unit.inMilliseconds

      if (value > 0) {
        destination.push(`${value}${isoLabel}`)
      }
    }

    return `P${dateParts.join('')}${timeParts.length > 0 ? 'T' : ''}${timeParts.join('')}`

  }
}

