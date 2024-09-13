import { Milliseconds } from "./milliseconds.mjs"

export interface RelativeTimeout {
  // this interface catches the case where done is not provided, and returns void rather than unknown
  (duration: Milliseconds): Promise<void>
  // this interface catches the case where done is provided, and returns the return type of done rather than unknown
  <A extends any[], T>(duration: Milliseconds, done?: (...args: A) => T | PromiseLike<T>, ...args: A): Promise<T>
}