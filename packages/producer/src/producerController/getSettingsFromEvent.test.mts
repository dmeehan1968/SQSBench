import { getSettingsFromEvent } from './getSettingsFromEvent.mjs'
import { SqsProducerControllerSettingsSchema } from '@sqsbench/schema'

describe('getSettingsFromEvent', () => {

  const baseEvent = {
    minRate: 1,
    maxRate: 10,
    rateDurationInMinutes: 5,
    rateScaleFactor: 1.5,
    dutyCycle: 0.75,
    weightDistribution: [1, 2, 3],
    parameterName: 'param',
    queueUrls: ['https://sqs.us-east-1.amazonaws.com/123456789012/queue1'],
    emitterArn: 'arn:aws:lambda:us-east-1:123456789012:function:my-function'
  }

  it('should parse valid event', () => {
    const settings = getSettingsFromEvent(baseEvent)
    expect(settings).toEqual(SqsProducerControllerSettingsSchema.parse(baseEvent))
  })

  it('should throw on invalid event', () => {
    expect(() => getSettingsFromEvent('invalid')).toThrow('received string')
  })

  it('should throw error if queueUrls is empty', () => {
    const event = {
      ...baseEvent,
      queueUrls: []
    }
    expect(() => getSettingsFromEvent(event)).toThrow('No queues')
  })

  it('should throw error if queueUrls is not an array', () => {
    const event = {
      ...baseEvent,
      queueUrls: ''
    }
    expect(() => getSettingsFromEvent(event)).toThrow('Expected array')
  })

  it('should throw error if minRate/maxRate is invalid', () => {
    const event = {
      ...baseEvent,
      minRate: baseEvent.maxRate + 1, // invalid because minRate > maxRate
    }

    expect(() => getSettingsFromEvent(event)).toThrow(/minRate \(\d+\) must be less than or equal to maxRate \(\d+\)/)
  })
})