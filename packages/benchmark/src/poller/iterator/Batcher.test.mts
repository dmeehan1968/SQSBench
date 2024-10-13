import { mock, mockFn } from 'jest-mock-extended'
import { Producing } from './types.mjs'
import { Batcher } from './Batcher.mjs'

describe('Batcher', () => {

  let sut: Batcher<number, number>
  let source: Producing<number>

  beforeEach(() => {
    source = mock<Producing<number>>()
    source[Symbol.asyncIterator] = mockFn().mockReturnValueOnce([1,2,3].values())
    sut = new Batcher(value => value, 2)
  })

  it('should batch', async () => {
    const result: number[][] = []
    const pending = [
      new Promise<void>(async (resolve) => {
        await sut.consume(source)
        resolve()
      }),
      new Promise<void>(async (resolve) => {
        const iter = sut[Symbol.asyncIterator]()
        for await (const num of iter) {
          result.push(num)
        }
        resolve()
      })
    ]
    await Promise.all(pending)
    expect(result).toEqual([[1,2],[3]])
  });
});