import { SqsProducerControllerSettings, SqsProducerControllerSettingsSchema } from '@sqsbench/schema'

export function getSettingsFromEvent(event: unknown): SqsProducerControllerSettings {
  const settings = SqsProducerControllerSettingsSchema.parse(event)

  if (!Array.isArray(settings.queueUrls) || settings.queueUrls.length === 0) {
    throw new Error('No queues')
  }

  return settings
}