import { LambdaClient } from '@aws-sdk/client-lambda'
import { Message, SQSClient } from '@aws-sdk/client-sqs'
import { SqsMessageProducer } from './SqsMessageProducer.mjs'
import { LambdaConsumer } from './LambdaConsumer.mjs'
import { ArrayBatcher } from './ArrayBatcher.mjs'
import { Acquired } from './types.mjs'
import { Pipeline } from './Pipeline.mjs'
import { Duration } from '@sqsbench/helpers'

const sqs = new SQSClient()
const lambda = new LambdaClient()

class Poller {
  constructor(
    private readonly lambda: LambdaClient,
    private readonly sqs: SQSClient,
  ) {
  }

  async poll() {
    const abort = new AbortController()
    const source = new SqsMessageProducer(this.sqs, abort.signal, () => ({
      QueueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/MyQueue',
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 1,
    }))
    const target = new LambdaConsumer(this.lambda, () => ({
      FunctionName: 'my-function',
    }))
    const batcher = new ArrayBatcher<Acquired<Message[]>, Message>(
      (acc, cur) => [...acc, ...cur.data],
      100,
      Duration.seconds(60),
    )

    setTimeout(() => abort.abort(), 10000)

    await new Pipeline(source, [batcher], target).process()

  }
}

export const handler = async () => {
  await new Poller(lambda, sqs).poll()
}