import { Duration } from '@sqsbench/helpers'
import { BacklogMonitor } from './BacklogMonitor.mjs'

async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const all: T[] = []
  for await (const item of iter) {
    all.push(item)
  }
  return all
}

describe('BacklogMonitor', () => {
  let sut: BacklogMonitor<number>
  const complete = jest.fn()

  beforeEach(() => {
    sut = new BacklogMonitor()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('should terminate on initial empty batch', async () => {
    // Arrange
    async function* source() {
      yield { data: [], acquiredIn: Duration.seconds(0) }
    }
    sut.consume(source()).then(complete)

    // Act
    const result = await collect(sut)

    // Assert
    expect(result).toHaveLength(0)
    expect(complete).toHaveBeenCalled()
  })

  it('should terminate on subsequent empty batch', async () => {
    // Arrange
    async function* source() {
      yield { data: [1, 2, 3], acquiredIn: Duration.seconds(0) }
      yield { data: [], acquiredIn: Duration.seconds(0) }
      yield { data: [4, 5, 6], acquiredIn: Duration.seconds(0) }
    }
    sut.consume(source()).then(complete)

    // Act
    const result = await collect(sut)

    // Assert
    expect(result).toEqual([
      { data: [1, 2, 3], acquiredIn: Duration.seconds(0) },
    ])
    expect(complete).toHaveBeenCalled()
  })

})