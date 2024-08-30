import { EventEmitter } from "@/infra/SqsTest/EventEmitter"

interface BatchEvents<T = any> {
  full: T[]
  empty: void
}

export class Batch<T> extends EventEmitter<BatchEvents<T>> {
  private readonly batch: T[] = []

  constructor(private readonly limit: number) {
    super()
  }

  async push(items: T[]) {
    while (items.length > 0) {
      this.batch.push(...items.splice(0, this.limit - this.batch.length))
      if (this.batch.length === this.limit) {
        await this.emit('full', this.batch)
      }
    }
  }

  async clear() {
    this.batch.splice(0)
    await this.emit('empty', undefined)
  }

  get length() {
    return this.batch.length
  }

  get spaceRemaining() {
    return this.limit - this.batch.length
  }

  filter(predicate: (item: T) => boolean) {
    return this.batch.filter(predicate)
  }

  toArray() {
    return [...this.batch]
  }
}