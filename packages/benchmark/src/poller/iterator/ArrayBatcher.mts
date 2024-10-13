import { Transforming } from './types.mjs'

export class ArrayBatcher<TIn, TOut = TIn> implements Transforming<TIn, TOut[]> {

  private accumulator: TOut[] = []
  private source: AsyncIterable<TIn> | undefined
  private readonly completions = new Set<() => void>

  constructor(
    readonly transform: (acc: TOut[], current: TIn) => TOut[],
    private readonly batchSize: number,
  ) {
  }

  async consume(source: AsyncIterable<TIn>): Promise<void> {
    this.source = source
    await new Promise<void>(resolve => this.completions.add(resolve))
  }

  private async* generator() {
    for await (const messages of this.source ?? []) {
      this.accumulator = this.transform(this.accumulator, messages)

      while (this.accumulator.length >= this.batchSize) {
        yield this.accumulator.splice(0, this.batchSize)
      }
    }

    while (this.accumulator.length) {
      yield this.accumulator.splice(0, this.batchSize)
    }

    for (const completion of this.completions) {
      completion()
    }
    this.completions.clear()
  }

  [Symbol.asyncIterator]() {
    return this.generator()
  }

}