import { MetricResolution, Metrics, MetricUnit } from "@aws-lambda-powertools/metrics"
import { ConsumerMetrics } from "./consumerMetrics.mjs"

export class AwsConsumerMetrics implements ConsumerMetrics {

  constructor(
    private readonly client: Metrics,
    private readonly highResMetrics: boolean = false,
  ) {
  }

  async addMessagesReceived(count: number) {
    this.client.addMetric(
      "MessagesReceived",
      MetricUnit.Count,
      count,
      this.highResMetrics ? MetricResolution.High : MetricResolution.Standard,
    )
  }
}