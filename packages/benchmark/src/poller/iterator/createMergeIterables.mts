type State<T> = {
  status: 'pending' | 'fulfilled' | 'rejected' | 'done'
  value: T | undefined
  error: any
  next: Promise<State<T>>
  iterator: AsyncIterator<T>
}

export enum Mode {
  NoClose,
  CloseNoWait,
  CloseWait,
}

export function createMergeIterables<T>({ mode }: { mode?: Mode } = {}) {
  mode ??= Mode.NoClose

  return async function* (...iterables: AsyncIterable<T>[]): AsyncGenerator<T> {

    function next(iterator: AsyncIterator<T>): State<T> {
      const state: State<T> = {
        status: 'pending',
        value: undefined,
        error: undefined,
        iterator,
        next: iterator.next()
          .then(result => {
            state.status = result.done ? 'done' : 'fulfilled'
            state.value = result.value
            return state
          })
          .catch(error => {
            state.status = 'rejected'
            state.error = error
            return state
          }),
      }
      return state
    }

    const iterators = new Map(
      iterables
        .map(iterable => iterable[Symbol.asyncIterator]())
        .map(iterator => [iterator, next(iterator)]),
    )

    try {

      while (iterators.size) {
        // We can get multiple settled results from a single race
        const promises = [...iterators.values()].map(state => state.next)
        await Promise.race(promises)

        // so we check all outstanding to see what we can yield
        for (const { status, iterator, value, error } of iterators.values()) {
          switch (status) {
            case 'pending':
              break

            case 'done':
              iterators.delete(iterator)
              break

            case 'fulfilled':
              yield value!
              iterators.set(iterator, next(iterator))
              break

            case 'rejected':
              iterators.delete(iterator)
              throw error // merely gets us to the finally block

            default:
              const err = new Error('unhandled status')
              console.error(err)
              throw err // merely gets us to the finally block
          }
        }
      }

    } finally {

      switch (mode) {
        case Mode.NoClose:
          break

        case Mode.CloseNoWait:
          for (const iterator of iterators.keys()) {
            iterator.return?.()
          }
          break

        case Mode.CloseWait:
          for (const iterator of iterators.keys()) {
            await iterator.return?.()
          }

          await Promise.allSettled([...iterators.values()].map(iterator => iterator.next))
          break
      }

      iterators.clear()
    }
  }
}