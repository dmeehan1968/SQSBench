import { Acquired, Consuming, Producing } from './types.mjs'

export class BacklogMonitor<T> implements Consuming<Acquired<T[]>>, Producing<Acquired<T[]>> {
  private source: AsyncIterable<Acquired<T[]>> | undefined

  private readonly completions = new Set<() => void>

  consume(source: AsyncIterable<Acquired<T[]>>): Promise<void> {
    this.source = source
    return new Promise<void>(resolve => this.completions.add(resolve))
  }

  private async* generator() {

    try {

      if (!this.source) {
        throw new Error('No source')
      }

      for await (const batch of this.source) {

        // stop on first empty receive
        if (batch.data.length === 0) {
          console.log('Empty Receive')
          break
        }

        yield batch
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