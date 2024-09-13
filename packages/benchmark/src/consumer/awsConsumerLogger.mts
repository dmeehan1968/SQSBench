import { Logger } from "@aws-lambda-powertools/logger"
import { Milliseconds } from "./milliseconds.mjs"
import { ConsumerLogger, Record } from "./consumerLogger.mjs"

export class AwsConsumerLogger implements ConsumerLogger {
  constructor(private readonly logger: Logger) {
  }

  async recordsReceived(records: Record[]) {
    this.logger.appendKeys({ records })
  }

  async perMessageDuration(perMessageDuration: Milliseconds) {
    this.logger.appendKeys({ perMessageDuration })
  }
}