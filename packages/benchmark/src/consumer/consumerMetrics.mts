export interface ConsumerMetrics {
  addMessagesReceived: (count: number) => Promise<void>
}