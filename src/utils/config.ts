import type { DeepReadonly } from "./types/readonly"
import { existsSync, readFileSync } from "fs"
import Logger from "./logger"
import configExample from "../../config.example.json"

export type ConfigType = DeepReadonly<typeof configExample>
const CONFIG_PATH = "/usr/src/app/config/config.json"
const logger = new Logger("Config")

export default function loadConfig(): ConfigType {

	if (!existsSync(CONFIG_PATH)) {
		logger.error(`No config file found at ${CONFIG_PATH}. Please ensure config.json exists.`)
		process.exit(1)
	}

	const file = readFileSync(CONFIG_PATH, "utf8")

	return JSON.parse(file) as ConfigType
}
