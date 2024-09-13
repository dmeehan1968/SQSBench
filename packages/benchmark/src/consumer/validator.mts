export interface Validator<T> {
  default(defaultValue: Exclude<T, undefined>): Validator<Exclude<T, undefined>>

  required(): Validator<Exclude<T, undefined>>

  asNumber(): number

  asBoolean(): boolean
}