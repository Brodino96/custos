import type { Snowflake } from "discord.js"
import type { DeepReadonly } from "./types/readonly"
import { join } from "path"
import { existsSync, readFileSync, writeFileSync } from "fs"
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

const CONFIG_PATH = join(__dirname, "config/config.json")
const DEFAULT_CONFIG: ConfigType = {

	checkInterval: 2,

	bot: { token: "PUT-YOUR-DISCORD-BOT-TOKEN-HERE", guildId: "000000000000000000", clientId: "000000000000000000" },

	joinRoles: { enabled: true, roles: [], expires: true, duration: 30 },

	switchingRoles: {
		enabled: true,
		roles: {
			"arole": [ "alot", "of", "roles" ]
		},
		duration: 30
	},

	moderation: { moderatorRoles: [], warn: {
			enabled: true, roles: [], canExpire: true, expiresAfter: 364, ban: {
				enabled: false, banMessage: "You've been banned for reaching too many warns"
			}
		}
	}
} as const

export default function loadConfig(): ConfigType {

	if (!existsSync(CONFIG_PATH)) {
		writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 4))
		Logger.warn(`No config.json found. A template has been created at\n${CONFIG_PATH}\nFill it in and restart the application`)
		return DEFAULT_CONFIG
	}

	const file = readFileSync(CONFIG_PATH, "utf8")

	return JSON.parse(file) as ConfigType
}
