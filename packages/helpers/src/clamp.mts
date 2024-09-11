interface ClampOptions {
  min?: number
  max: number
  throws?: boolean
}

export function clamp(
  values: number | number[],
  { min = 0, max, throws = false }: ClampOptions,
) {
  values = Array.isArray(values) ? values : [values]
  if (throws && values.some(value => value < min)) {
    throw new Error(`Value must be greater than or equal to ${min}`)
  }
  if (throws && values.some(value => value > max)) {
    throw new Error(`Value must be less than or equal to ${max}`)
  }
  return Math.min(Math.max(min, ...values), max)
}