import { Milliseconds } from "./milliseconds.mjs"

export async function nodeRelativeTimeout<A extends any[], T>(duration: Milliseconds, done?: (...args: A) => T | PromiseLike<T>, ...args: A) {
  return new Promise<T | void>(resolve => setTimeout(() => resolve(done?.(...args)), duration))
}