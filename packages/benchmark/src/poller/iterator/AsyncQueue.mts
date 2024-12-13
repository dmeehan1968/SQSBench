type Resolver<T> = (value: T) => void

export class AsyncQueue<T> {
  private readonly items: Resolver<T>[] = []

  enqueue() {
    return new Promise<T>(resolve => {
      this.items.push(resolve)
    })
  }

  dequeue(fetch: () => T) {
    const resolver = this.items.shift()
    if (resolver) {
      resolver(fetch())
    }

    return !!resolver
  }
}