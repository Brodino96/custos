import { Bot } from "./modules/bot"
import joinRoles from "./modules/joinRoles"
import switchingRoles from "./modules/switchingRoles"
import Warns from "./modules/warns"
import PersistentRoles from "./modules/persistentRoles"
import loadConfig from "./utils/config"
import Exile from "./modules/exile"

const config = loadConfig()
const bot = new Bot(config)

if (config.joinRoles.enabled) {
	bot.addModule(joinRoles)
}

if (config.warn.enabled) {
	bot.addModule(Warns)
}

if (config.switchingRoles.enabled) {
	bot.addModule(switchingRoles)
}

if (config.persistentRoles.enabled) {
	bot.addModule(PersistentRoles)
}

if (config.exile.enabled) {
	bot.addModule(Exile)
}

await bot.init()