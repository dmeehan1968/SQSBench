import { Context } from "aws-lambda"

export abstract class LambdaController<T, R> {
  protected abstract handle(event: T, context: Context): Promise<R>

  handler() {
    return this.handle.bind(this)
  }
}