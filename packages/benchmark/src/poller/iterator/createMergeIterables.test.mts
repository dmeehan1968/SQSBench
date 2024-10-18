import { createMergeIterables, Mode } from './createMergeIterables.mjs'

async function* asyncGeneratorFromArray(arr: number[]) {
  yield* arr
}

describe('createMergeIterables', () => {

  it('should merge multiple sources', async () => {
    // Arrange
    const sources = [
      [1, 2, 3],
      [4, 5, 6],
    ]
    // Act
    const result: number[] = []
    const merge = createMergeIterables<number>()
    for await (const value of merge(...sources.map(asyncGeneratorFromArray))) {
      result.push(value)
    }
    // Assert
    expect(result).toEqual(expect.arrayContaining(sources.flat()))
  })

  it('should handle downstream errors', async () => {
    // Arrange
    const sources = [
      [1, 2, 3],
      [4, 5, 6],
    ]
    // Act
    const result: number[] = []
    const merge = createMergeIterables<number>()
    try {
      for await (const value of merge(...sources.map(asyncGeneratorFromArray))) {
        if (value === 5) {
          // noinspection ExceptionCaughtLocallyJS
          throw new Error('downstream error')
        }
        result.push(value)
      }
    } catch (error) {

    }
    // Assert
    expect(result).toEqual(expect.arrayContaining([1, 4, 2]))
  })

  describe('modes', () => {

    let goodSourceClosed = false
    async function* errorSource() {
      yield 1
      yield 2
      throw new Error('upstream')
    }
    async function* goodSource() {
      try {
        yield 3
        yield 4
        yield 5
        yield 6
      } finally {
        await new Promise(resolve => setTimeout(resolve, 100))
        goodSourceClosed = true
      }
    }

    const result: number[] = []
    let merge: ReturnType<typeof createMergeIterables<number>> | undefined

    async function test() {
      if (!merge) {
        throw new Error('merge not defined, must be created in each test case')
      }
      for await (const value of merge(goodSource(), errorSource())) {
        result.push(value)
      }
    }

    beforeEach(() => {
      jest.useFakeTimers()
      goodSourceClosed = false
    })

    afterEach(() => {
      jest.useRealTimers()
      merge = undefined
      result.splice(0)
    })

    it('should not close on upstream errors', async () => {
      // Arrange
      merge = createMergeIterables<number>()

      // Act
      await expect(test()).rejects.toThrow('upstream')

      // Assert
      expect(goodSourceClosed).toBeFalsy()
      expect(result).toEqual([3, 1, 4, 2, 5])
    })

    it('should close without wait on upstream errors', async () => {
      // Arrange
      merge = createMergeIterables<number>({ mode: Mode.CloseNoWait })

      // Act
      await expect(test()).rejects.toThrow('upstream')

      // Assert
      expect(goodSourceClosed).toBeFalsy()
      await jest.advanceTimersByTimeAsync(100)
      expect(goodSourceClosed).toBeTruthy()
      expect(result).toEqual([3, 1, 4, 2, 5])
    })

    it('should close with wait on upstream errors', async () => {
      // Arrange
      merge = createMergeIterables<number>({ mode: Mode.CloseWait })
      expect.assertions(3)
      const promise = test().catch(error => {
        expect(error.message).toEqual('upstream')
      })

      // Act
      await jest.advanceTimersByTimeAsync(100)
      await promise

      // Assert
      expect(goodSourceClosed).toBeTruthy()
      expect(result).toEqual([3, 1, 4, 2, 5])
    })

  })

})