import { Duration } from '@sqsbench/helpers'
import { clearTimeout } from 'node:timers'

export class Timer {
  private _promise: Promise<{ type: 'timeout' }> | undefined
  private reject: ((reason?: any) => void) | undefined
  private timeout: ReturnType<typeof setTimeout> | undefined = undefined

  constructor(private readonly duration: Duration) {
  }

  start() {
    void this.createPromise()
  }

  stop() {
    if (this.timeout) {
      this.reject?.()
      this.timeout && clearTimeout(this.timeout)
      this.timeout = undefined
      this._promise = undefined
    }
  }

  private createPromise() {
    if (!this._promise) {
      this._promise = new Promise<{ type: 'timeout' }>((resolve, reject) => {
        this.reject = reject
        this.timeout && clearTimeout(this.timeout)
        this.timeout = setTimeout(() => {
          this.timeout = undefined
          this._promise = undefined
          resolve({ type: 'timeout' })
        }, this.duration.toMilliseconds())
      })
    }
    return this._promise

  }

  get promise() {
    return this.createPromise()
  }

}