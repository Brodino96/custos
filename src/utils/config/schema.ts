import { z } from "zod"

export const configSchema = z
	.object({
		checkInterval: z.number().positive(),

		logLevel: z.number().int().min(0).max(3).default(3),

		bot: z.object({
			token: z.string().min(1),
			guildId: z.string().min(1),
			clientId: z.string().min(1),
			moderatorRoles: z.array(z.string())
		}),

		persistentRoles: z.object({
			enabled: z.boolean()
		}),

		warn: z.object({
			enabled: z.boolean(),
			roles: z.array(z.string())
		}),

		exile: z.object({
			enabled: z.boolean(),
			roles: z.array(z.string())
		}),

		probation: z.object({
			enabled: z.boolean(),
			duration: z.number().positive(),
			roles: z.object({
				from: z.array(z.string()),
				to: z.array(z.string())
			})
		})
	})
	.loose()
