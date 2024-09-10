import { isIdlePhase, IdlePhaseLogger } from "./isIdlePhase.mjs"
import { EmitterErrorLogger, EmitterSuccessLogger, sendMessages } from "./sendMessages.mjs"
import { Emitter, DelaysLogger, producerController, ProducerControllerProps } from "./producerController.mjs"
import { weightedMessageDistribution } from "../weightedMessageDistribution.mjs"
import { mockFn } from "jest-mock-extended"

jest.mock('./isIdlePhase.mjs')
jest.mock('./sendMessages.mjs')
jest.mock('../weightedMessageDistribution.mjs')

describe('producerController', () => {

  const mockLogDelays = mockFn<DelaysLogger>()
  const mockLogEmitterSuccesses = mockFn<EmitterSuccessLogger>()
  const mockLogEmitterErrors = mockFn<EmitterErrorLogger>()
  const mockLogIdlePhaseStats = mockFn<IdlePhaseLogger>()
  const mockEmitter = mockFn<Emitter>()

  let fixture: ProducerControllerProps
  let rateChangeAt: Date
  let currentTime: Date

  beforeEach(() => {
    rateChangeAt = new Date()
    rateChangeAt.setMinutes(rateChangeAt.getMinutes() + 5, 0, 0)
    currentTime = new Date()
    currentTime.setMinutes(currentTime.getMinutes() + 1, 0, 0)

    // the values for the fixture don't matter, just the structure
    fixture = {
      settings: {
        minRate: 1,
        maxRate: 16,
        rateScaleFactor: 2,
        rateDurationInMinutes: 60,
        dutyCycle: 0.5,
        parameterName: 'parameterName',
        queueUrls: ['queueUrl'],
        emitterArn: 'arn',
        weightDistribution: [1]
      },
      state: {
        rate: 1,
        rateChangeAt
      },
      currentTime,
      logDelays: mockLogDelays,
      logEmitterSuccesses: mockLogEmitterSuccesses,
      logEmitterErrors: mockLogEmitterErrors,
      logIdlePhaseStats: mockLogIdlePhaseStats,
      emitter: mockEmitter,
    }
  })

  afterAll(() => {
    jest.restoreAllMocks()
  })

  it('should not send messages when idle', async () => {
    // Arrange
    const mockIsIdlePhase = jest.mocked(isIdlePhase)
    const mockSendMessages = jest.mocked(sendMessages)
    const mockWeightedMessageDistribution = jest.mocked(weightedMessageDistribution)

    mockIsIdlePhase.mockReturnValue(true)

    // Act
    await producerController(fixture)

    // Assert
    expect(mockIsIdlePhase).toHaveBeenCalledWith({
      rate: fixture.state.rate,
      rateChangeAt: fixture.state.rateChangeAt,
      ...fixture.settings,
      currentTime: fixture.currentTime,
      logIdlePhaseStats: fixture.logIdlePhaseStats,
    })
    expect(mockWeightedMessageDistribution).not.toHaveBeenCalled()
    expect(mockSendMessages).not.toHaveBeenCalled()
  })

  it('should generate and send messages when not idle', async () => {
    // Arrange
    const mockIsIdlePhase = jest.mocked(isIdlePhase)
    const mockSendMessages = jest.mocked(sendMessages)
    const mockWeightedMessageDistribution = jest.mocked(weightedMessageDistribution)

    mockIsIdlePhase.mockReturnValue(false)
    mockWeightedMessageDistribution.mockReturnValue([1, 2 ,3])

    // Act
    await producerController(fixture)

    // Assert
    expect(mockIsIdlePhase).toHaveBeenCalled()
    expect(mockIsIdlePhase).toHaveBeenCalledWith({
      rate: fixture.state.rate,
      rateChangeAt: fixture.state.rateChangeAt,
      ...fixture.settings,
      currentTime: fixture.currentTime,
      logIdlePhaseStats: mockLogIdlePhaseStats,
    })
    expect(mockWeightedMessageDistribution).toHaveBeenCalledWith(
      fixture.state.rate,
      60,
      fixture.settings.weightDistribution
    )
    expect(mockLogDelays).toHaveBeenCalledWith([1, 2, 3])
    expect(mockSendMessages).toHaveBeenCalledWith({
      currentTime: fixture.currentTime,
      delays: [1, 2, 3],
      queueUrls: fixture.settings.queueUrls,
      emitter: mockEmitter,
      logEmitterSuccesses: mockLogEmitterSuccesses,
      logEmitterErrors: mockLogEmitterErrors,
    })
  })
})