import { Duration } from "@sqsbench/helpers"

export interface RelativeTimeout {
  // the first signature is for when done is not specified, and returns a void promise
  (duration: Duration): Promise<void>
  // the second signature is for when done is specified, and returns a promise of the type returned by done
  <A extends any[], T>(duration: Duration, done: (...args: A) => T | PromiseLike<T>, ...args: A): Promise<T>
}