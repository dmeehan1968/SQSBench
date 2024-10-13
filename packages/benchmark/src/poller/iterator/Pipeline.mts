import { Consuming, Producing, Transforming } from './types.mjs'

export class Pipeline<TSource, TDest> {
  constructor(
    private readonly source: Producing<TSource>,
    private readonly transformers: Transforming<any, any>[],
    private readonly target: Consuming<TDest>,
  ) {}

  async process() {

    let currentProducer: Producing<any> = this.source

    const pending: Promise<any>[] = []

    for (const transformer of this.transformers) {
      pending.push(transformer.consume(currentProducer))
      currentProducer = transformer
    }

    pending.push(this.target.consume(currentProducer))

    await Promise.allSettled(pending)
  }
}


