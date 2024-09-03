import pLimit from "p-limit"
import { Logger } from "@aws-lambda-powertools/logger"

type Subscriber<T> = (payload: T) => void | Promise<void>

interface IEventEmitter<Events extends Record<string, any>> {
  on<K extends keyof Events>(event: K, subscriber: Subscriber<Events[K]>): IEventEmitter<Events>

  off<K extends keyof Events>(event: K, subscriber: Subscriber<Events[K]>): void
}

export class EventEmitter<Events extends Record<string, any>> implements IEventEmitter<Events> {
  private readonly subscribers = new Map<string, Set<Subscriber<any>>>()

  constructor(protected readonly logger: Logger) {}

  on<K extends keyof Events>(event: K | K[], subscriber: Subscriber<Events[K]>) {

    (Array.isArray(event) ? event : [event]).forEach(event => {
      const subscribers = this.subscribers.get(event as string) ?? new Set()
      subscribers.add(subscriber)
      this.subscribers.set(event as string, subscribers)
    })

    return this
  }

  off<K extends keyof Events>(event: K | K[], subscriber: Subscriber<Events[K]>) {

    (Array.isArray(event) ? event : [event]).forEach(event => {
      const subscribers = this.subscribers.get(event as string)
      if (subscribers) {
        subscribers.delete(subscriber)
      }
    })

  }

  async emit<K extends keyof Events>(event: K, payload: Events[K], options?: { concurrency: number }) {
    const subscribers = this.subscribers.get(event as string) ?? new Set()
    if (subscribers.size === 0) {
      return
    }
    const limit = pLimit(options?.concurrency ?? 1)
    const all = [...subscribers].map(async (subscriber) => limit(() => subscriber(payload)))
    this.logger.info(`Emitting '${String(event)}' to ${all.length} subscribers`, { payload })
    const results = await Promise.allSettled(all)
    results.filter(result => result.status === 'rejected').forEach(result => this.emit('error', result.reason))
    return
  }
}