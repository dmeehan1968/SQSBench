import { SQSBatchItemFailure, SQSBatchResponse, SQSEvent, SQSRecord } from "aws-lambda"
import { LambdaController } from "../ports/lambdaController.mjs"
import { JsonSchema, SqsConsumerPayloadSchema, SQSRecordNormaliserSchema } from "@sqsbench/schema"
import { ConsumerMessageProcessing } from "../domain/consumerMessageProcessing.mjs"

type ConsumerInput = SQSRecord | SQSRecord[] | SQSEvent
type ConsumerOutput = SQSBatchResponse

interface Dependencies {
  messageProcessor: ConsumerMessageProcessing
  logPerMessageDuration: () => void
  logHighResMetrics: () => void
}

export class ConsumerLambdaController extends LambdaController<ConsumerInput, ConsumerOutput> {

  constructor(private readonly deps: Dependencies) {
    super()
  }

  async handle(event: ConsumerInput): Promise<ConsumerOutput> {

    this.deps.logPerMessageDuration()
    this.deps.logHighResMetrics()

    const messages = SQSRecordNormaliserSchema.parse(event)

    const records = this.adaptSqsMessagesToConsumerRecords(messages)

    const results = await this.deps.messageProcessor.execute(records)

    return this.adaptConsumerResultsToSqsBatchItemFailures(results, messages.map(message => message.messageId))
  }

  private adaptConsumerResultsToSqsBatchItemFailures(results: (PromiseSettledResult<any>)[], identifiers: string[]): SQSBatchResponse {
    return {
      batchItemFailures: results
        .map(({ status }, index) => (status === 'rejected' ? { itemIdentifier: identifiers[index] } : undefined))
        .filter((item): item is SQSBatchItemFailure => !!(item && item.itemIdentifier)),
    }
  }

  private adaptSqsMessagesToConsumerRecords(messages: SQSRecord[]) {
    return messages.map(message => {
      const record = JsonSchema.pipe(SqsConsumerPayloadSchema).safeParse(message.body)
      return record.success ? record.data : record.error
    })
  }
}