export class MultiSourceConsumer<T, U> {
  private sources: AsyncIterable<T>[] = []
  private completions = new Set<() => void>()

  constructor(private readonly invoke: (value: T) => Promise<U>) {
  }

  async consume(source: AsyncIterable<T>): Promise<void> {
    this.sources.push(source)
    return new Promise<void>(resolve => this.completions.add(resolve))
  }

  async* generator() {
    try {

      if (this.sources.length === 0) {
        throw new Error('No sources, call consume() first at least once')
      }

      const iterators = this.sources.map(source => source[Symbol.asyncIterator]())
      const promiseMap = new Map(iterators.map(iterator => [iterator, iterator.next().then(result => ({
        iterator,
        result,
      }))]))

      while (promiseMap.size > 0) {
        const { result, iterator } = await Promise.race(promiseMap.values())

        if (result.done) {
          promiseMap.delete(iterator)
        } else {
          yield await this.invoke(result.value)
          promiseMap.set(iterator, iterator.next().then(result => ({ iterator, result })))
        }
      }

    } finally {
      for (const completion of this.completions) {
        completion()
      }
      this.completions.clear()
    }
  }

  [Symbol.asyncIterator]() {
    return this.generator()
  }
}