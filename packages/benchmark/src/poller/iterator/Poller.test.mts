import { InvocationType, LambdaClient } from '@aws-sdk/client-lambda'
import { SQSClient, ReceiveMessageCommandOutput } from '@aws-sdk/client-sqs'
import { Poller } from './Poller.mjs'
import { mock } from 'jest-mock-extended'

describe('Poller', () => {
  const lambda = mock<LambdaClient>()
  const sqs = mock<SQSClient>()

  it('should poll', async () => {
    // Arrange

    let id = 0
    const p = async () => {
      // await new Promise((resolve) => setTimeout(resolve, 500))
      const output = {
        Messages: [
          {
            MessageId: id.toString(),
            ReceiptHandle: '1',
            Body: 'foo',
            Attributes: {
              ApproximateReceiveCount: '1',
              SentTimestamp: '1',
              SenderId: '1',
              ApproximateFirstReceiveTimestamp: '1',
            },
            MD5OfBody: '1',
          },
        ],
        '$metadata': {},
      } satisfies ReceiveMessageCommandOutput
      id++
      return output
    }

    sqs.send
      .mockImplementationOnce(p)
      .mockImplementationOnce(p)
      .mockImplementation(async () => ({}))

    lambda.send.mockReturnValue({} as any)

    const params = {
      queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/MyQueue',
      queueArn: 'arn:aws:sqs:us-east-1:123456789012:MyQueue',
      batchSize: 10,
      batchWindow: 1,
      functionArn: 'aws:lambda:region:acc:function_name',
      maxSessionDuration: 60,
      maxConcurrency: 5,
      invocationType: InvocationType.RequestResponse,
    }

    const sut = new Poller(lambda, sqs, params)

    // Act
    await sut.poll()

    // Assert

    // ReceiveMessageCommand
    expect(sqs.send).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.objectContaining({
        QueueUrl: params.queueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 1,
      }),
    }), expect.objectContaining({
      abortSignal: expect.any(AbortSignal),
    }))

    // DeleteMessageBatchCommand
    expect(sqs.send).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.objectContaining({
        QueueUrl: params.queueUrl,
        Entries: [
          { Id: '0', ReceiptHandle: '1' },
          { Id: '1', ReceiptHandle: '1' },
        ],
      }),
    }))

    // Lambda Invoke
    expect(lambda.send).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.objectContaining({
        FunctionName: params.functionArn,
        InvocationType: InvocationType.RequestResponse,
        Payload: expect.stringMatching(/"Records".*"messageId":"0","receiptHandle":"1".*"messageId":"1","receiptHandle":"1"/),
      }),
    }))
  })
})