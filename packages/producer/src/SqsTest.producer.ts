import { Context } from "aws-lambda"
import { GetParameterCommand, PutParameterCommand, SSMClient } from "@aws-sdk/client-ssm"
import {
  SendMessageBatchCommand,
  SQSClient,
} from "@aws-sdk/client-sqs"
import { chunkArray } from "@sqsbench/helpers"
import { z } from "zod"
import pLimit from "p-limit"
import { InvocationType, InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda"
import middy from "@middy/core"

import { SqsProducerSettingsSchema } from "@sqsbench/schema"

const ssm = new SSMClient()
const sqs = new SQSClient()
const lambda = new LambdaClient()

export const handler = middy(async (unknown: unknown, context: Context) => {

  console.log('Event', JSON.stringify(unknown, null, 2))

  const SendMessagesSchema = z.object({
    queueUrl: z.string(),
    delays: z.number().array(),
    startTime: z.coerce.date(),
  })

  const messageSettings = SendMessagesSchema.safeParse(unknown)

  if (messageSettings.success) {
    const { queueUrl, delays, startTime } = messageSettings.data
    await sendMessages(queueUrl, delays, startTime)
    return
  }

  const producerSettings = SqsProducerSettingsSchema.parse(unknown)

  const { dutyCycle, parameterName, queueUrls } = producerSettings

  if (!Array.isArray(queueUrls) || queueUrls.length === 0) {
    throw new Error('No queues')
  }

  const res = await ssm.send(new GetParameterCommand({
    Name: parameterName,
  }))

  const startTime = new Date()
  const isIdlePhase = startTime.getMinutes() >= (60 * dutyCycle)

  let settings: { rate: number } = { rate: 1 }

  if (res.Parameter) {
    // console.log('Parameter', res.Parameter.Value)
    settings = JSON.parse(res.Parameter.Value ?? '{ "rate": 1 }')
  }

  console.log('Settings', settings)

  if (startTime.getMinutes() === 0) {
    await ssm.send(new PutParameterCommand({
      Name: parameterName,
      Value: JSON.stringify({ rate: settings.rate < 4096 ? settings.rate * 2 : 1 }),
      Overwrite: true,
    }))
  }

  function getRandomDelay() {
    const baseDelay = Math.floor(Math.random() * 20)

    // Add some randomness for busy/quiet periods
    const busyPeriod = Math.random() < 0.5 ? 0 : Math.floor(Math.random() * 40)

    return Math.min(baseDelay + busyPeriod, 60)
  }

  if (isIdlePhase) {
    console.log('Idle Phase - No actions')
    return
  }

  console.log(`Duty Phase - Send ${settings.rate} messages`)

  // Generate random delays for each message
  const delays = Array.from({ length: settings.rate }, () => getRandomDelay()).sort((a, b) => a - b)

  const pending: Promise<any>[] = []

  // limit concurrency to 50, same as lambda client connection limit
  const limit = pLimit(50)

  // Send 500 delays to each lambda invocation (which result in 50 batch sends of 10 messages)
  const chunks = chunkArray(delays, 500)

  for (let chunk of chunks) {
    for (let queueUrl of queueUrls) {
      pending.push(limit(async () => {
        console.log(`Sending ${chunk.length} messages to ${queueUrl}`)
        const res = await lambda.send(new InvokeCommand({
          FunctionName: context.invokedFunctionArn,
          InvocationType: InvocationType.Event,
          Payload: Buffer.from(JSON.stringify({
            queueUrl,
            delays: chunk,
            startTime,
          } satisfies z.infer<typeof SendMessagesSchema>)),
        }))
        if (res.StatusCode === undefined || res.StatusCode < 200 || res.StatusCode >= 300) {
          console.error(`Lambda invocation failed with status code ${res.StatusCode} - ${res.FunctionError}`)
        }
        return res
      }))
    }
  }

  await Promise.allSettled(pending)
})

async function sendMessages(queueUrl: string, delays: number[], startTime: Date) {

  const latencies: number[] = []
  const limit = pLimit(50)

  function clamp(min: number, max: number, value: number) {
    return Math.min(Math.max(min, value), max)
  }

  const pending = chunkArray(delays, 10).map(chunk => {
    return limit(() => {
      latencies.push(Date.now() - startTime.getTime())
      return sqs.send(new SendMessageBatchCommand({
        QueueUrl: queueUrl,
        Entries: chunk.map((delay, index) => ({
          Id: index.toString(),
          DelaySeconds: clamp(0, 60, delay - Math.floor((Date.now() - startTime.getTime()) / 1000)),
          MessageBody: JSON.stringify({ index, delay }),
        })),
      }))
    })
  })

  const res = await Promise.allSettled(pending)

  console.log('Latencies (ms per batch of 10)', JSON.stringify(latencies))

  // console.log('Batch Send Results', JSON.stringify(res))
  res.filter(res => res.status === 'rejected').forEach(res => {
    console.error('Batch Send Error', res.reason)
  })

}