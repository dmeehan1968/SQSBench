import { Transforming } from './types.mjs'
import { Duration } from '@sqsbench/helpers'
import { Timer } from './Timer.mjs'

type TimeoutEvent = { type: 'timeout', done?: never, value?: never }
type IteratorEvent<T> = IteratorResult<T> & { type: 'next' }
type Event<T> = TimeoutEvent | IteratorEvent<T>

export class ArrayBatcher<TIn, TOut = TIn> implements Transforming<TIn, TOut[]> {

  private accumulator: TOut[] = []
  private source: AsyncIterable<TIn> | undefined
  private readonly completions = new Set<() => void>

  constructor(
    readonly transform: (acc: TOut[], current: TIn) => TOut[],
    private readonly batchSize: number,
    private readonly batchWindow: Duration,
  ) {
  }

  async consume(source: AsyncIterable<TIn>): Promise<void> {
    this.source = source
    await new Promise<void>(resolve => this.completions.add(resolve))
  }

  private async* generator() {

    if (!this.source) {
      throw new Error('No source')
    }
    let done = false
    const iterator = this.source[Symbol.asyncIterator]()
    const batchWindow = new Timer(this.batchWindow)
    let next: Promise<Event<TIn>> | undefined

    try {

      while (!done) {

        // set up a race between a timer, source iterator and abort

        next ??= (async () => ({ type: 'next', ...await iterator.next() }))()

        const pending: Promise<Event<TIn>>[] = [
          next,
          batchWindow.promise,
        ]

        const result = await Promise.race(pending)
        // console.log('result', result)

        switch (result.type) {
          case 'timeout':
            while (this.accumulator.length) {
              yield this.accumulator.splice(0, this.batchSize)
            }
            break
          case 'next':
            done = result.done ?? false
            if (!done) {
              this.accumulator = this.transform(this.accumulator, result.value)
            }

            while (this.accumulator.length >= this.batchSize) {
              batchWindow.stop()
              yield this.accumulator.splice(0, this.batchSize)
            }

            next = undefined
            break
          default:
            throw new Error('Unexpected event')
        }
      }

    } finally {

      batchWindow.stop()

      while (this.accumulator.length) {
        yield this.accumulator.splice(0, this.batchSize)
      }

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