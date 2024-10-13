import { BatchWindow } from './BatchWindow.mjs'
import { Duration } from '@sqsbench/helpers'

describe('BatchWindow', () => {
  let batchWindow: BatchWindow
  let onExpiry: jest.Mock

  beforeEach(() => {
    jest.useFakeTimers()
    jest.spyOn(global, 'setTimeout')
    jest.spyOn(global, 'clearTimeout')
    onExpiry = jest.fn()
    batchWindow = new BatchWindow(Duration.milliseconds(1000))
    batchWindow.subscribe(onExpiry)
  })

  afterEach(() => {
    batchWindow[Symbol.dispose]()
    jest.useRealTimers()
    jest.resetAllMocks()
  })

  test('starts the timer', () => {
    batchWindow.start()
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 1000)
  })

  test('calls onExpiry after duration', () => {
    batchWindow.start()
    jest.advanceTimersByTime(1000)
    expect(onExpiry).toHaveBeenCalled()
  })

  test('restarts the timer', () => {
    batchWindow.start()
    batchWindow.restart()
    expect(clearTimeout).toHaveBeenCalled()
    expect(setTimeout).toHaveBeenCalledTimes(2)
  })

  test('stops the timer', () => {
    batchWindow.start()
    batchWindow.stop()
    expect(clearTimeout).toHaveBeenCalled()
  })

  test('dispose stops the timer', () => {
    batchWindow.start()
    batchWindow[Symbol.dispose]()
    expect(clearTimeout).toHaveBeenCalled()
  })
})