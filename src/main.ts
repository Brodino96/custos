import { Bot } from "./bot"
import loadConfig from "./utils/config"
import Exile from "./modules/exile"
import PersistentRoles from "./modules/persistentRoles"
import Warn from "./modules/warn"

const config = loadConfig()
const bot = new Bot(config)

if (config.persistentRoles.enabled) {
	bot.addModule(PersistentRoles)
}

if (config.exile.enabled) {
	bot.addModule(Exile)
}

if (config.warn.enabled) {
	bot.addModule(Warn)
}


await bot.init()