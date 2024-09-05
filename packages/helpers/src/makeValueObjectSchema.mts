import { z, ZodEffects, ZodType, ZodTypeAny, ZodTypeDef } from "zod"

class ValueObject<T, Final> {

  constructor(
    private readonly __id: string,
    private readonly value: T,
    private readonly toWire: ZodEffects<ZodTypeAny, Final, T> | ZodType<Final, ZodTypeDef, T>
  ) {}

  valueOf() {
    return this.value
  }
  toJSON() {
    return { __id: this.__id, value: this.toWire.parse(this.value) }
  }
}

export function makeValueObjectSchema<InputType, ValueType, WireType>({ name, valueSchema, toValue, toWire }: {
  name: string,
  valueSchema: ZodType<ValueType, ZodTypeDef, InputType>,
  toWire?: ZodEffects<ZodTypeAny, WireType, ValueType> | ZodType<WireType, ZodTypeDef, ValueType>,
  toValue?: ZodEffects<ZodTypeAny, ValueType, WireType> | ZodType<ValueType, ZodTypeDef, WireType>,
}) {
  toWire ??= z.any().transform(v => v as unknown as WireType)
  toValue ??= z.any().transform(v => v as unknown as ValueType)

  const envelope = z.object({ __id: z.literal(name), value: z.any() })
  return z.union([
    z.string().transform(v => JSON.parse(v)).pipe(envelope).transform(v => v.value).pipe(toValue).pipe(valueSchema),
    valueSchema,
  ]).transform(v => new ValueObject(name, v, toWire))
}

// const DurationSchema = makeValueObjectSchema({
//   name: 'Duration',
//   valueSchema: z.custom<Duration>(v => v instanceof Duration).refine(v => v.toMilliseconds() > 0),
//   toWire: z.custom<Duration>(v => v instanceof Duration).transform(v => v.toMilliseconds()),
//   toValue: z.number().transform(v => Duration.millis(v)),
// })
//
// const y = DurationSchema.parse(Duration.millis(1000))
// console.log(y.valueOf())
// console.log(y.toJSON())
//
// const x = DurationSchema.parse('{ "__id": "Duration", "value": 1 }')
// console.log(x.valueOf())
// console.log(x.toJSON())
//
//
// const PositiveNumber = makeValueObjectSchema({
//   name: 'PositiveNumber',
//   valueSchema: z.number().int().positive()
// })
//
// const ISODate = makeValueObjectSchema({
//   name: 'ISODate',
//   valueSchema: z.coerce.date(),
//   toWire: z.date().transform(v => v.toISOString()),
//   toValue: z.string().transform(v => new Date(v)),
// })
//
// const d = ISODate.parse('{ "__id": "ISODate", "value": "2022-01-01T00:00:00.000Z" }')
// console.log(d.valueOf())
// console.log(d.toJSON())