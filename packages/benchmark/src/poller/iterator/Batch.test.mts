import { Batch } from './Batch.mjs'
import { BatchWindow } from './BatchWindow.mjs'
import { Duration } from '@sqsbench/helpers'

describe('Batch', () => {
  let batch: Batch<number>
  let batchWindow: BatchWindow

  beforeEach(() => {
    batchWindow = new BatchWindow(Duration.milliseconds(0))
    batch = new Batch<number>(3, batchWindow)
  })

  afterEach(() => {
    batch.dispose()
  })

  it('should emit batch when size is reached', async () => {
    batch.push(1, 2, 3)
    expect(await batch.next()).toEqual({ done: false, value: [1, 2, 3] })
  })

  it('should returns batches from iterator', async () => {
    batch.push(1, 2, 3, 4)
    expect(await batch.next()).toEqual({ done: false, value: [1, 2, 3] })
    expect(await batch.next()).toEqual({ done: false, value: [4] })
  })

  it('should return done after finalise', async () => {
    batch.finalise()
    expect(await batch.next()).toEqual({ done: true, value: undefined })
  })

  it('should throw on push to finalised batch', async () => {
    batch.finalise()
    expect(() => batch.push(1)).toThrow('Batch is finalised')
  })

  it('should be iterable', async () => {
    batch.push(1, 2, 3, 4)
    batch.finalise()
    const batches: number[][] = []
    for await (const b of batch) {
      batches.push(b)
    }
    expect(batches).toEqual([[1, 2, 3], [4]])
  });
})
