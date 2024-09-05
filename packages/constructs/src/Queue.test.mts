import { App, Stack } from 'aws-cdk-lib'
import { Match, Template } from 'aws-cdk-lib/assertions'
import { Queue } from './Queue.mjs'

describe('Queue', () => {
  it('should provide useful defaults', () => {
    const app = new App()
    const stack = new Stack(app, 'TestStack')
    new Queue(stack, 'Default')

    const template = Template.fromStack(stack)
    template.hasResourceProperties('AWS::SQS::Queue', Match.objectLike({
      QueueName: Match.stringLikeRegexp('^TestStack-[a-zA-Z0-9]{8}$'),
      MessageRetentionPeriod: 1209600,
      ReceiveMessageWaitTimeSeconds: 20,
    }))
  })

  it('should only create a queue if no DLQ specified', () => {
    const app = new App()
    const stack = new Stack(app, 'TestStack')
    new Queue(stack, 'Default')

    const template = Template.fromStack(stack)

    template.resourceCountIs('AWS::SQS::Queue', 1)
  })

  it('should provide useful defaults with DLQ', () => {
    const app = new App()
    const stack = new Stack(app, 'TestStack')
    new Queue(stack, 'Default', { deadLetterQueue: { maxReceiveCount: 3 }})

    const template = Template.fromStack(stack)

    // Queue
    template.hasResourceProperties('AWS::SQS::Queue', Match.objectLike({
      QueueName: Match.stringLikeRegexp('^TestStack-[a-zA-Z0-9]{8}$'),
      MessageRetentionPeriod: 1209600,
      ReceiveMessageWaitTimeSeconds: 20,
    }))

    // DLQ
    template.hasResourceProperties('AWS::SQS::Queue', Match.objectLike({
      QueueName: Match.stringLikeRegexp('^TestStackDLQ-[a-zA-Z0-9]{8}$'),
      MessageRetentionPeriod: 1209600,
      ReceiveMessageWaitTimeSeconds: Match.absent(),
      RedriveAllowPolicy: { redrivePermission: 'allowAll' },
    }))
  })

})