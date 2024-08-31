import { z } from "zod"

export const JsonSchema = z.string().transform(v => JSON.parse(v))