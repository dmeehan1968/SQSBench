import { Transforming } from './types.mjs'

export class Batcher<TIn, TOut> implements Transforming<TIn, TOut[]>, AsyncIterable<TOut[]> {

  private readonly items: TOut[] = []
  private source: AsyncIterable<TIn> | undefined
  private completions = new Set<() => void>

  constructor(
    readonly transform: (value: TIn) => TOut[],
    private readonly batchSize: number,
  ) {
  }

  async consume(source: AsyncIterable<TIn>): Promise<void> {
    this.source = source
    await new Promise<void>(resolve => this.completions.add(resolve))
  }

  private async* generator() {
    for await (const messages of this.source ?? []) {
      console.log('received messages', messages)
      if (Array.isArray(messages)) {
        this.items.push(...this.transform(messages) as any)
      } else {
        this.items.push(this.transform(messages) as any)
      }

      while (this.items.length >= this.batchSize) {
        console.log('yielding batch', this.items)
        yield this.items.splice(0, this.batchSize)
      }
    }

    while (this.items.length) {
      console.log('yielding final', this.items)
      yield this.items.splice(0, this.batchSize)
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