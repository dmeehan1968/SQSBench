import { EventEmitter } from "./EventEmitter.mjs"
import { clamp } from "@sqsbench/helpers"
import { Logger } from "@aws-lambda-powertools/logger"

interface TimerEvents {
  timeout: void
}

export class Timer extends EventEmitter<TimerEvents> {
  private timer: NodeJS.Timeout | undefined
  private endTime: Date | undefined

  constructor(private _duration: number, logger: Logger) {
    super(logger)
    this.start()
  }

  get timeRemainingInSeconds() {
    if (!this.endTime) {
      return 0
    }
    const now = Date.now()
    if (now > this.endTime.getTime()) {
      return 0
    }
    return Math.floor((this.endTime.getTime() - now) / 1000)
  }

  get duration() {
    return this._duration
  }

  start(duration: number = this.duration) {
    if (duration === 0) {
      return
    }
    if (!this.timer) {
      this._duration = duration
      this.timer = setTimeout(() => this.emit('timeout', undefined), clamp(this.duration, { min: 0, max: Infinity }))
    } else {
      this.timer.refresh()
    }
    this.endTime = new Date(Date.now() + this.duration)
  }

  stop() {
    clearTimeout(this.timer)
    this.timer = undefined
    this.endTime = undefined
  }

  [Symbol.dispose]() {
    this.stop()
  }
}