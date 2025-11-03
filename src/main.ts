import { Bot } from "./bot"
import loadConfig from "./utils/config"
import Exile from "./modules/exile"

const config = loadConfig()
const bot = new Bot(config)

if (config.exile.enabled) {
	bot.addModule(Exile)
}

await bot.init()