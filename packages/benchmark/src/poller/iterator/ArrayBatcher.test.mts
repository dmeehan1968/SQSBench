import { mock, mockFn } from 'jest-mock-extended'
import { Producing } from './types.mjs'
import { ArrayBatcher } from './ArrayBatcher.mjs'
import { Duration } from '@sqsbench/helpers'

describe('ArrayBatcher', () => {

  let sut: ArrayBatcher<number>
  let source: Producing<number>
  const batchWindow = Duration.seconds(1)

  beforeEach(() => {
    jest.useFakeTimers()
    source = mock<Producing<number>>()
    sut = new ArrayBatcher(cur => [cur], 2, batchWindow)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should batch', async () => {
    source[Symbol.asyncIterator] = mockFn().mockReturnValueOnce([1, 2, 3].values())
    const result: number[][] = []
    const pending: Promise<void>[] = [
      sut.consume(source),
      (async () => {
        for await (const num of sut[Symbol.asyncIterator]()) {
          result.push(num)
        }
      })(),
    ]
    await Promise.all(pending)
    expect(result).toEqual([[1, 2], [3]])
  })

  it('should flush a partial batch on window timeout', async () => {

    // Arrange
    const iter = sut[Symbol.asyncIterator]()
    async function* gen() {
      yield 1
      yield 2
      yield 3
      await new Promise(resolve => setTimeout(resolve, batchWindow.toMilliseconds()+500))
      yield 4
    }

    // Act
    const pending = sut.consume(gen())

    // Assert
    expect(await iter.next()).toEqual({ done: false, value: [1, 2]})

    // call next without waiting so we can then fire the timeout
    const next = iter.next()
    await jest.advanceTimersByTimeAsync(batchWindow.toMilliseconds())

    // We should get the partial batch
    expect(await next).toEqual({ done: false, value: [3]})

    // This causes the fourth item to be yielded without causing another
    // timeout, so the final value should be yielded and then done
    await jest.advanceTimersByTimeAsync(500)

    // We should get the final batch
    expect(await iter.next()).toEqual({ done: false, value: [4]})

    // And then done
    expect(await iter.next()).toEqual({ done: true })

    // Wait for everything to finish
    await pending
  }, 1000)

  it('should allow early return', async () => {
    // Arrange
    const iter = sut[Symbol.asyncIterator]()
    async function* gen() {
      yield 1
      yield 2
      yield 3
      yield 4
    }

    // Act
    const pending = sut.consume(gen())

    // Assert
    expect(await iter.next()).toEqual({ done: false, value: [1, 2]})
    expect(await iter.return()).toEqual({ done: true })
    expect(await pending).toBeUndefined()
    expect(await iter.next()).toEqual({ done: true })

  }, 1000)
})

