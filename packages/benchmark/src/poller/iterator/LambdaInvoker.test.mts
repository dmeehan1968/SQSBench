import { LambdaInvoker } from './LambdaInvoker.mjs'
import { mock } from 'jest-mock-extended'
import { LambdaClient } from '@aws-sdk/client-lambda'
import { Uint8ArrayBlobAdapter } from '@smithy/util-stream'

describe('LambdaInvoker', () => {

  const mockClient = mock<LambdaClient>()

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('should invoke with request payload and return response payload', async () => {

    // Arrange
    const FunctionName = 'aws:lambda:region:acc:function_name'
    const RequestPayload = { foo: 'bar' }
    const ResponsePayload = { bar: 'baz' }
    mockClient.send.mockReturnValueOnce({
      Payload: Uint8ArrayBlobAdapter.fromString(JSON.stringify(ResponsePayload)),
    } as any)
    const params = jest.fn(() => ({ FunctionName }))
    const sut = new LambdaInvoker(mockClient, params)
    const source = async function* () {
      yield RequestPayload
    }()
    const pending = sut.consume(source)

    // Act
    const result = []
    for await (const value of sut) {
      result.push(value)
    }

    // Assert
    expect(mockClient.send).toHaveBeenCalledWith(expect.objectContaining({
      input: {
        Payload: JSON.stringify(RequestPayload),
        FunctionName,
      },
    }))
    expect(result).toEqual([{ req: RequestPayload, res: ResponsePayload }])
    expect(await pending).toBeUndefined()
  })
})