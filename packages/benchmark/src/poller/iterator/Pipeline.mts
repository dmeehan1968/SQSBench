import { Consuming, Producing } from './types.mjs'

export class Pipeline<TSource, TDest> {
  constructor(
    private readonly source: Producing<TSource>,
    private readonly stages: (Consuming<any> & Producing<any>)[],
    private readonly target: Consuming<TDest>,
  ) {}

  async process() {

    let currentProducer: Producing<any> = this.source

    const pending: Promise<any>[] = []

    for (const stage of this.stages) {
      pending.push(stage.consume(currentProducer))
      currentProducer = stage
    }

    pending.push(this.target.consume(currentProducer))

    await Promise.allSettled(pending)
  }
}


