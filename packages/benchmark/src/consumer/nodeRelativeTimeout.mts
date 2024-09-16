import { Duration } from "@sqsbench/helpers/duration"
import { RelativeTimeout } from "./relativeTimeout.mjs"

export const nodeRelativeTimeout: RelativeTimeout = <A extends any[], T>(duration: Duration, done?: (...args: A) => T | PromiseLike<T>, ...args: A) => {
  return new Promise<T | void>(resolve => setTimeout(() => resolve(done?.(...args)), duration.toMilliseconds()))
}


