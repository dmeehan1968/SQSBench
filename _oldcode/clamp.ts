export function clamp(values: number | number[], { min = 0, max }: { min?: number, max: number }) {
  return Math.min(Math.max(min, ...(Array.isArray(values) ? values : [values])), max)
}