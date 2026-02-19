import type { z } from "zod"
import type { configSchema } from "./schema.ts"

export type Config = z.infer<typeof configSchema>
