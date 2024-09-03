import { z } from "zod"

export const SQSRecordSchema = z.object({
  messageId: z.string(),
  receiptHandle: z.string(),
  body: z.string(),
  attributes: z.object({
    AWSTraceHeader: z.string().optional(),
    ApproximateReceiveCount: z.string(),
    SentTimestamp: z.string(),
    SenderId: z.string(),
    ApproximateFirstReceiveTimestamp: z.string(),
    SequenceNumber: z.string().optional(),
    MessageGroupId: z.string().optional(),
    MessageDeduplicationId: z.string().optional(),
    DeadLetterQueueSourceArn: z.string().optional(),
  }),
  messageAttributes: z.record(z.object({
    stringValue: z.string().optional(),
    binaryValue: z.any().optional(),
    stringListValues: z.array(z.string()).optional(),
    binaryListValues: z.array(z.any()).optional(),
    dataType: z.enum(['String', 'Number', 'Binary'] as const),
  })),
  md5OfBody: z.string(),
  eventSource: z.string(),
  eventSourceARN: z.string(),
  awsRegion: z.string(),
})