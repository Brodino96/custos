import type { Snowflake } from "discord.js"
import { load } from "js-toml"
import type { DeepReadonly } from "./types"

type ConfigType = DeepReadonly<{
	token: string
	guildId: Snowflake
	clientId: Snowflake
	tempRole: {
		enabled: boolean,
		rolesId: Array<Snowflake>
		roleDuration: number
		checkInterval: number
	}
}>

const configData = await Bun.file("./config.toml").text()
//@ts-ignore
const Config: ConfigType = load(configData)
export default Config