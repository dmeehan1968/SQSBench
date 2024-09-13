import { Milliseconds } from "./milliseconds.mjs"

export interface Record {
  delay: number
  index: number
}
export interface ConsumerLogger {
  recordsReceived: (records: Record[]) => Promise<void>
  perMessageDuration: (perMessageDuration: Milliseconds) => Promise<void>
}