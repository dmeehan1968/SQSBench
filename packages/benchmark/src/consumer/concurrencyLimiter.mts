export interface ConcurrencyLimiter {
  <T>(fn: () => Promise<T>): Promise<T>
}