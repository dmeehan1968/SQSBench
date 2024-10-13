import { mock, mockFn } from 'jest-mock-extended'
import { Producing } from './types.mjs'
import { ArrayBatcher } from './ArrayBatcher.mjs'

describe('ArrayBatcher', () => {

  let sut: ArrayBatcher<number>
  let source: Producing<number>

  beforeEach(() => {
    source = mock<Producing<number>>()
    source[Symbol.asyncIterator] = mockFn().mockReturnValueOnce([1,2,3].values())
    sut = new ArrayBatcher((acc, cur) => ([...acc, cur]), 2)
  })

  it('should batch', async () => {
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
    expect(result).toEqual([ [1,2], [3] ])
  });
});