import { Bot } from "./bot"
import loadConfig from "./utils/config"
import Exile from "./modules/exile"
import PersistentRoles from "./modules/persistentRoles"

const config = loadConfig()
const bot = new Bot(config)

if (config.persistentRoles.enabled) {
	bot.addModule(PersistentRoles)
}

if (config.exile.enabled) {
	bot.addModule(Exile)
}


await bot.init()