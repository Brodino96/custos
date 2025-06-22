import type { Role, Snowflake } from "discord.js"
import { load } from "js-toml"
import type { DeepReadonly } from "./types/readonly"

type ConfigType = DeepReadonly<{
	token: string
	guildId: Snowflake
	clientId: Snowflake
	tempRole: {
		enabled: boolean
		rolesId: Array<Snowflake>
		roleDuration: number
		checkInterval: number
	}
	moderation: {
		enabled: boolean
		roles: Array<Snowflake>
		checkInterval: number
		warn: {
			rolesId: Array<Snowflake>
			banAfterLimit: boolean
			banMessage: string
			canExpire: boolean
			expiresAfter: number
		}
	}
	autoTempRole: {
		enabled: true
		channel: Snowflake
		roles: {
			before: Array<Snowflake>
			after: Array<Snowflake>
		}
		duration: number
		interval: number
	}
	manualRole: {
		enabled: true
		roles: {
			before: Snowflake
			after: Snowflake
		}
		duration: number
		interval: number
	}
}>

const configData = await Bun.file("./config.toml").text()
//@ts-ignore
const Config: ConfigType = load(configData)
export default Config