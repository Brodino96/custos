import type { Snowflake } from "discord.js"
import type { DeepReadonly } from "./types/readonly"

import { existsSync, readFileSync } from "fs"
import Logger from "./logger"

export type ConfigType = DeepReadonly<{

	checkInterval: number

	bot: {
		token: string
		guildId: Snowflake
		clientId: Snowflake
	}

	moderation: {
		moderatorRoles: Array<Snowflake>
		warn: {
			enabled: boolean
			roles: Array<Snowflake>
			canExpire: boolean
			expiresAfter: number
			ban: {
				enabled: boolean
				banMessage: string
			}
		}
	}

	switchingRoles: {
		enabled: true
		roles: Record<Snowflake, Array<Snowflake>>
		duration: number
	}

	joinRoles: {
		enabled: boolean
		roles: Array<Snowflake>
		expires: boolean
		duration: number
	}
}>

const CONFIG_PATH = "/usr/src/app/config/config.json"

export default function loadConfig(): ConfigType {

	if (!existsSync(CONFIG_PATH)) {
		Logger.error(`No config file found at ${CONFIG_PATH}. Please ensure config.json exists.`)
		process.exit(1)
	}

	const file = readFileSync(CONFIG_PATH, "utf8")

	return JSON.parse(file) as ConfigType
}
