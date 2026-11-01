export interface RetryOptions {
  attempts: number
  delayMs: number
  shouldRetry: (err: unknown) => boolean
}

export async function retry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt >= options.attempts || !options.shouldRetry(err)) throw err
      await new Promise((resolve) => setTimeout(resolve, options.delayMs))
    }
  }
}
