import { Bot } from "./bot"
import loadConfig from "./utils/config"
import Exile from "./modules/exile"
import PersistentRoles from "./modules/persistentRoles"

const config = loadConfig()
const bot = new Bot(config)

if (config.exile.enabled) {
	bot.addModule(Exile)
}

if (config.persistentRoles.enabled) {
	bot.addModule(PersistentRoles)
}

await bot.init()