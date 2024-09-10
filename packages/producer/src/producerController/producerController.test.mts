import {  IdlePhaseLogger, IdlePhaseCondition } from "./isIdlePhase.mjs"
import { EmitterErrorLogger, EmitterSuccessLogger, SendMessages } from "./sendMessages.mjs"
import {
  MessageEmitter,
  DelaysLogger,
  producerController,
  ProducerControllerParams,
  ProducerControllerDependencies,
} from "./producerController.mjs"
import { WeightedMessageDistribution } from "../weightedMessageDistribution.mjs"
import { mockFn } from "jest-mock-extended"

describe('producerController', () => {

  const mockIsIdlePhase = mockFn<IdlePhaseCondition>()
  const mockSendMessages = mockFn<SendMessages>()
  const mockWeightedMessageDistribution = mockFn<WeightedMessageDistribution>()

  const mockLogDelays = mockFn<DelaysLogger>()
  const mockLogEmitterSuccesses = mockFn<EmitterSuccessLogger>()
  const mockLogEmitterErrors = mockFn<EmitterErrorLogger>()
  const mockLogIdlePhaseStats = mockFn<IdlePhaseLogger>()
  const mockEmitter = mockFn<MessageEmitter>()

  const dependencies: ProducerControllerDependencies = {
    logDelays: mockLogDelays,
    logEmitterSuccesses: mockLogEmitterSuccesses,
    logEmitterErrors: mockLogEmitterErrors,
    logIdlePhaseStats: mockLogIdlePhaseStats,
    emitter: mockEmitter,
    isIdlePhase: mockIsIdlePhase,
    weightedMessageDistribution: mockWeightedMessageDistribution,
    sendMessages: mockSendMessages,
  }

  let params: ProducerControllerParams
  let rateChangeAt: Date
  let currentTime: Date

  beforeEach(() => {
    rateChangeAt = new Date()
    rateChangeAt.setMinutes(rateChangeAt.getMinutes() + 5, 0, 0)
    currentTime = new Date()
    currentTime.setMinutes(currentTime.getMinutes() + 1, 0, 0)

    // the values for the params don't matter, just the structure
    params = {
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
    }
  })

  afterAll(() => {
    jest.restoreAllMocks()
  })

  it('should not send messages when idle', async () => {
    // Arrange
    mockIsIdlePhase.mockReturnValue(true)

    // Act
    await producerController(params, dependencies)

    // Assert
    expect(mockIsIdlePhase).toHaveBeenCalledWith({
      rate: params.state.rate,
      rateChangeAt: params.state.rateChangeAt,
      ...params.settings,
      currentTime: params.currentTime,
      logIdlePhaseStats: dependencies.logIdlePhaseStats,
    })
    expect(mockWeightedMessageDistribution).not.toHaveBeenCalled()
    expect(mockSendMessages).not.toHaveBeenCalled()
  })

  it('should generate and send messages when not idle', async () => {
    // Arrange

    mockIsIdlePhase.mockReturnValue(false)
    mockWeightedMessageDistribution.mockReturnValue([1, 2 ,3])

    // Act
    await producerController(params, dependencies)

    // Assert
    expect(mockIsIdlePhase).toHaveBeenCalled()
    expect(mockIsIdlePhase).toHaveBeenCalledWith({
      rate: params.state.rate,
      rateChangeAt: params.state.rateChangeAt,
      ...params.settings,
      currentTime: params.currentTime,
      logIdlePhaseStats: mockLogIdlePhaseStats,
    })
    expect(mockWeightedMessageDistribution).toHaveBeenCalledWith(
      params.state.rate,
      60,
      params.settings.weightDistribution
    )
    expect(mockLogDelays).toHaveBeenCalledWith([1, 2, 3])
    expect(mockSendMessages).toHaveBeenCalledWith({
      currentTime: params.currentTime,
      delays: [1, 2, 3],
      queueUrls: params.settings.queueUrls,
      emitter: mockEmitter,
      logEmitterSuccesses: mockLogEmitterSuccesses,
      logEmitterErrors: mockLogEmitterErrors,
    })
  })
})