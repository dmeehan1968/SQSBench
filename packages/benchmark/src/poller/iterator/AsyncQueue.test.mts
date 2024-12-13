import { AsyncQueue } from './AsyncQueue.mjs'

describe('AsyncQueue', () => {
  let queue: AsyncQueue<number>

  beforeEach(() => {
    queue = new AsyncQueue<number>()
  })

  afterEach(async () => {
  })

  it('should enqueue and dequeue items', async () => {
    const promise = queue.enqueue()
    queue.dequeue(() => 1)
    const result = await promise
    expect(result).toEqual(1)
  })

})