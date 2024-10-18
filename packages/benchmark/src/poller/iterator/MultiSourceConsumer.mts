import { createMergeIterables } from './createMergeIterables.mjs'

export class MultiSourceConsumer<T, U> {
  private sources: AsyncIterable<T>[] = []
  private completions = new Set<() => void>()
  private mergeSources = createMergeIterables<T>()

  constructor(private readonly invoke: (value: T) => Promise<U>) {
  }

  async consume(source: AsyncIterable<T>): Promise<void> {
    this.sources.push(source)
    return new Promise<void>(resolve => this.completions.add(resolve))
  }

  async* generator() {

    if (this.sources.length === 0) {
      throw new Error('No sources, call consume() first at least once')
    }

    try {
      for await (const value of this.mergeSources(...this.sources)) {
        yield await this.invoke(value)
      }
    } finally {
      for (const completion of this.completions) {
        completion()
      }
    }

  }

  [Symbol.asyncIterator]() {
    return this.generator()
  }
}