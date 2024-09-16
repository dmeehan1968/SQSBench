import { mock, mockFn } from 'jest-mock-extended'
import { controller, Delay } from './controller.mjs'
import { ConsumerMetrics } from "./consumerMetrics.mjs"
import { Record } from "./record.mjs"

describe('consumer controller', () => {

  const records: Record[] = [
    { index: 0, delay: 0 },
    { index: 1, delay: 10 },
    { index: 2, delay: 20 },
  ]

  let metrics: ConsumerMetrics
  let nonConcurrentDelay: Delay

  beforeEach(() => {
    metrics = mock<ConsumerMetrics>()
    nonConcurrentDelay = mockFn<Delay>()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('should add the messages received metric', async () => {

    await controller({ records, metrics, nonConcurrentDelay })
    expect(metrics.addMessagesReceived).toHaveBeenCalledWith(3)

  })

  it('should delay each record', async () => {

    await controller({ records, metrics, nonConcurrentDelay })
    expect(nonConcurrentDelay).toHaveBeenCalledTimes(3)

  })

  it('should return PromiseSettledResult', async () => {

      const result = await controller({ records, metrics, nonConcurrentDelay })
      expect(result).toEqual([
        { status: 'fulfilled', value: undefined },
        { status: 'fulfilled', value: undefined },
        { status: 'fulfilled', value: undefined },
      ])

  })

  it('should return rejected records', async () => {

      nonConcurrentDelay = mockFn<Delay>()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('delay error'))
        .mockResolvedValueOnce(undefined)

      const result = await controller({ records, metrics, nonConcurrentDelay })
      expect(result).toEqual([
        { status: 'fulfilled', value: undefined },
        { status: 'rejected', reason: new Error('delay error') },
        { status: 'fulfilled', value: undefined },
      ])

  })
})