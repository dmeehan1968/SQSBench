export type JsonifiablePrimitive = string | number | boolean | null
export type JsonifiableObject = { [property: string]: Jsonifiable } | { toString(): string } | { toJSON(): string }
export type JsonifiableArray = Jsonifiable[]
export type Jsonifiable = JsonifiablePrimitive | JsonifiableObject | JsonifiableArray