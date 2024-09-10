import { isIdlePhase } from "./isIdlePhase.mjs"
import { sendMessages } from "./sendMessages.mjs"
import { Emitter, producerController, ProducerControllerProps } from "./producerController.mjs"
import { weightedMessageDistribution } from "../weightedMessageDistribution.mjs"
import { mock } from "jest-mock-extended"
import { Logger } from "@aws-lambda-powertools/logger"

jest.mock('./isIdlePhase.mjs')
jest.mock('./sendMessages.mjs')
jest.mock('../weightedMessageDistribution.mjs')

describe('producerController', () => {

  const mockLogger = mock<Logger>()
  const mockEmitter = mock<Emitter>()

  let fixture: ProducerControllerProps
  let rateChangeAt: Date
  let currentTime: Date

  beforeEach(() => {
    rateChangeAt = new Date()
    rateChangeAt.setMinutes(rateChangeAt.getMinutes() + 5, 0, 0)
    currentTime = new Date()
    currentTime.setMinutes(currentTime.getMinutes() + 1, 0, 0)

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
      logger: mockLogger,
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
      logger: fixture.logger
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
      logger: fixture.logger
    })
    expect(mockWeightedMessageDistribution).toHaveBeenCalledWith(
      fixture.state.rate,
      60,
      fixture.settings.weightDistribution
    )
    expect(mockLogger.appendKeys).toHaveBeenCalledWith({
      delays: [1, 2, 3]
    })
    expect(mockSendMessages).toHaveBeenCalledWith({
      currentTime: fixture.currentTime,
      delays: [1, 2, 3],
      queueUrls: fixture.settings.queueUrls,
      emitter: mockEmitter,
      logger: fixture.logger
    })
  })
})