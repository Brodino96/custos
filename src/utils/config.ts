import type { Snowflake } from "discord.js"
import { load } from "js-toml"
import type { DeepReadonly } from "./types"

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
		// mute: {
		// 	roleId: Snowflake
		// 	canExpire: boolean
		// 	expiresAfter: number
		// }
	}
}>

const configData = await Bun.file("./config.toml").text()
//@ts-ignore
const Config: ConfigType = load(configData)
export default Config