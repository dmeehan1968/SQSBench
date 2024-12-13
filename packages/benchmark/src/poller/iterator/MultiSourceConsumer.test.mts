import { MultiSourceConsumer } from './MultiSourceConsumer.mjs'

async function* asyncGenerator(arr: number[]) {
  yield* arr
}

describe('MultiSourceConsumer', () => {

  const sut = new MultiSourceConsumer<number, number>(async value => value)

  it('should fail to iterate when there are no sources', async () => {
    // Arrange
    const iter = sut[Symbol.asyncIterator]()
    const next = iter.next()
    // Assert
    await expect(next).rejects.toThrow('No sources, call consume() first at least once');
  })

  it('should iterate over a single source', async () => {
    // Arrange
    const expected = [1, 2, 3]
    const pending = sut.consume(asyncGenerator(expected))
    // Act
    const result = []
    for await (const value of sut) {
      result.push(value)
    }
    // Assert
    expect(result).toEqual(expected)
    await expect(pending).resolves.toBeUndefined()
  })

  it('should iterate over multiple sources', async () => {
    // Arrange
    const expected = [1, 2, 3, 4]
    const pending = [
      sut.consume(asyncGenerator(expected.slice(0, 2))).then(),
      sut.consume(asyncGenerator(expected.slice(2))).then(),
    ]
    // Act
    const result = []
    for await (const value of sut) {
      result.push(value)
    }
    // Assert
    expect(result).toEqual(expect.arrayContaining(expected))
    expect(await Promise.all(pending)).toEqual([undefined, undefined])
  })
})