import { SQSClient } from '@aws-sdk/client-sqs'
import { mock } from 'jest-mock-extended'
import { SqsBatchItemFailureConsumer } from './SqsBatchItemFailureConsumer.mjs'
import { SQSRecord } from 'aws-lambda'

function createSqsRecord(messageId: string, receiptHandle: string, body?: string): SQSRecord {
  return {
    messageId,
    receiptHandle,
    body: body ?? '',
    attributes: {
      ApproximateReceiveCount: '1',
      SentTimestamp: '1',
      SenderId: '1',
      ApproximateFirstReceiveTimestamp: '1',
    },
    messageAttributes: {},
    md5OfBody: '1',
    eventSource: 'aws:sqs',
    eventSourceARN: 'arn',
    awsRegion: 'us-east-1',
  } satisfies SQSRecord
}

describe('SqsBatchItemFailureConsumer', () => {

  const QueueUrl = 'http://example.com'
  const client = mock<SQSClient>();
  let sut: SqsBatchItemFailureConsumer

  beforeEach(() => {
    sut = new SqsBatchItemFailureConsumer(client, QueueUrl)
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('should delete all messages when there are no failures', async () => {
    // Arrange
    const source = async function* () {
      yield {
        req: {
          Records: [
            createSqsRecord('1', '1'),
            createSqsRecord('2', '2'),
          ],
        },
        res: { batchItemFailures: [] },
      }
    }

    // Act
    await sut.consume(source());

    // Assert
    expect(client.send).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.objectContaining({
        QueueUrl,
        Entries: [
          { Id: '0', ReceiptHandle: '1' },
          { Id: '1', ReceiptHandle: '2' },
        ],
      }),
    }))
  })

  it('should delete successful messages but not failures', async () => {
    // Arrange
    const source = async function* () {
      yield {
        req: {
          Records: [
            createSqsRecord('1', '1'),
            createSqsRecord('2', '2'),
          ],
        },
        res: { batchItemFailures: [{ itemIdentifier: '1' }] },
      };
    }();

    // Act
    await sut.consume(source);

    // Assert
    expect(client.send).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.objectContaining({
        QueueUrl,
        Entries: [
          { Id: '0', ReceiptHandle: '2' },
        ],
      }),
    }))
  })

  it('should not call delete message when there are no successes', async () => {
    // Arrange
    const source = async function* () {
      yield {
        req: {
          Records: [
            createSqsRecord('1', '1'),
            createSqsRecord('2', '2'),
          ]
        },
        res: { batchItemFailures: [{ itemIdentifier: '1' }, { itemIdentifier: '2' }] },
      };
    }();

    // Act
    await sut.consume(source);

    // Assert
    expect(client.send).not.toHaveBeenCalled();
  })
})