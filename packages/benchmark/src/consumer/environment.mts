import { ValidationBuilder } from "./validationBuilder.mjs"

export class Environment<Key extends keyof any> {
  constructor(private readonly env: Record<string, string | undefined>) {
  }

  get(name: Key) {
    return new ValidationBuilder(name as string, this.env[name as string])
  }
}