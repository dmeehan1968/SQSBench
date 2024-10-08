import { Context } from "aws-lambda"

export interface ConsumerLogger {
  context: (context: Context) => void
  perMessageDuration: () => void
  highResMetrics: () => void
  messagesReceived: (count: number) => void
  latency: (sentAt: Date) => void
  error: (error: unknown) => void
  flushMetrics: () => void
}