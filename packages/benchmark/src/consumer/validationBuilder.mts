import { Validator } from "./validator.mjs"

export class ValidationBuilder<T> implements Validator<T> {
  constructor(private id: string, private value: T) {
  }

  default<V>(defaultValue: Exclude<V, undefined>): ValidationBuilder<Exclude<V, undefined>> {
    const newValue = (this.value === undefined ? defaultValue : this.value) as Exclude<V, undefined>
    return new ValidationBuilder(this.id, newValue)
  }

  required(): ValidationBuilder<Exclude<T, undefined>> {
    if (this.value === undefined) {
      throw new Error(`Value for ${this.id} is required but was undefined`)
    }
    return new ValidationBuilder(this.id, this.value as Exclude<T, undefined>)
  }

  asNumber(): number {
    if (typeof this.value === 'number') {
      return this.value
    }

    const value = Number(String(this.value).trim())
    if (isNaN(value)) {
      throw new Error(`Value for ${this.id} is not a number`)
    }

    return value
  }

  asBoolean(): boolean {
    if (typeof this.value === 'boolean') {
      return this.value
    }

    if (typeof this.value === 'string') {
      return /^(?:true|yes|on|1)$/i.test(this.value)
    }

    throw new Error(`Value for ${this.id} is not a string or boolean`)
  }

  as<R>(fn: (value: T) => R): R {
    return fn(this.value)
  }
}