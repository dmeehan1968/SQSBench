import { BatchWindow } from './BatchWindow.mjs'
import { AsyncQueue } from './AsyncQueue.mjs'

export class Batch<T> implements Disposable, AsyncIterableIterator<T[]> {

  private items: T[] = []
  private requestQueue = new AsyncQueue<T[]>()
  private finalised = false
  private instanceIterator: AsyncIterableIterator<T[]>

  constructor(
    private readonly size: number,
    private readonly batchWindow: BatchWindow
  ) {
    this.batchWindow.subscribe(this.onWindowExpiry.bind(this))
    this.instanceIterator = this.asyncIterator()
  }

  push(...items: T[]) {
    if (this.finalised) {
      throw new Error('Batch is finalised')
    }

    this.items.push(...items)

    while (this.items.length >= this.size) {
      if (!this.requestQueue.dequeue(() => this.items.splice(0, this.size))) {
        break
      }
    }

    this.resetBatchWindow()
  }

  private onWindowExpiry() {
    if (this.items.length) {
      this.requestQueue.dequeue(() => this.items.splice(0, this.size))
    }
    this.resetBatchWindow()
  }

  private resetBatchWindow() {
    if (this.items.length) {
      this.batchWindow.restart()
    } else {
      this.batchWindow.stop()
    }
  }

  private async *asyncIterator(): AsyncIterableIterator<T[]> {
    while (true) {
      if (this.items.length >= this.size) {
        yield this.items.splice(0, this.size)
      } else if (this.finalised && this.items.length === 0) {
        break
      } else {
        yield this.requestQueue.enqueue()
      }
    }
  }

  finalise() {
    this.finalised = true
  }

  dispose() {
    this.finalise()
    while (this.requestQueue.dequeue(() => this.items.splice(0, this.size))) {
      // do nothing
    }
    this.batchWindow[Symbol.dispose]()
  }

  next() {
    return this.instanceIterator.next()
  }

  [Symbol.asyncIterator]() {
    return this.asyncIterator()
  }

  [Symbol.dispose]() {
    this.dispose()
  }
}