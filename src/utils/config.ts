import type { Snowflake } from "discord.js"
import { load } from "js-toml"

// Only ChatGPT | Michigan TypeScript could defeat TypeScript 
type DeepReadonly<T> = {
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	readonly [K in keyof T]: T[K] extends (...args: any[]) => any
	  ? T[K] // If it's a function, keep it as is
	  : T[K] extends object
	  ? DeepReadonly<T[K]> // If it's an object or array, recurse
	  : T[K]; // Otherwise, keep the property as is
  };

type ConfigType = DeepReadonly<{
	token: string
	guildId: Snowflake
	clientId: Snowflake
	tempRole: {
		enabled: boolean,
		rolesId: ReadonlyArray<Snowflake>
		roleDuration: number
		checkInterval: number
	}
}>

const configData = await Bun.file("./config.toml").text()
//@ts-ignore
const Config: ConfigType = load(configData)
export default Config