import { Duration } from '@sqsbench/helpers'

export class BatchWindow implements Disposable {

  private subscribers: (() => void)[] = []

  private timeout: ReturnType<typeof setTimeout> | undefined = undefined

  constructor(
    private readonly duration: Duration,
  ) {}

  start() {
    this.timeout = setTimeout(() => {
      this.subscribers.forEach(sub => sub())
    }, this.duration.toMilliseconds())
  }

  restart() {
    this.stop()
    this.start()
  }

  stop() {
    this.timeout && clearTimeout(this.timeout)
    this.timeout = undefined
  }

  subscribe(subscriber: () => void) {
    this.subscribers.push(subscriber)
  }

  [Symbol.dispose]() {
    this.stop()
    this.subscribers.splice(0)
  }

}