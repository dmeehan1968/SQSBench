import { Record } from "../../record.mjs"
import { ConsumerMessageProcessing } from "../domain/consumerMessageProcessing.mjs"

interface Dependencies {
  logMessagesReceived: (count: number) => void
  synchronousDelay: () => Promise<void>
}

export class ConsumerMessageProcessor implements ConsumerMessageProcessing {

  constructor(private readonly deps: Dependencies) {}

  async execute(records: (Record | Error)[]): Promise<PromiseSettledResult<any>[]> {

    this.deps.logMessagesReceived(records.length)

    return Promise.allSettled(records.map(record => {
      if (record instanceof Error) {
        return Promise.reject(record)
      }

      return this.deps.synchronousDelay()
    }))

  }
}