import { Duration } from '@sqsbench/helpers'

export interface Acquired<T> {
  data: T
  acquiredIn: Duration
}

export interface Producing<T> extends AsyncIterable<T> {
}

export interface Consuming<T> {
  consume(source: AsyncIterable<T>): Promise<void>
}

export interface Transforming<TIn, TOut> extends Consuming<TIn>, Producing<TOut> {
}