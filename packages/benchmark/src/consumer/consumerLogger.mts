import { Context } from "aws-lambda"
import { Duration } from "@sqsbench/helpers"

export interface ConsumerLogger {
  [Symbol.dispose]: () => void
  context: (context: Context) => void
  perMessageDuration: (duration: Duration) => void
  highResMetrics: (enabled: boolean) => void
  messagesReceived: (count: number) => void
  error: (error: unknown) => void
}