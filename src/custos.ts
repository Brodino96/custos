import { Logger } from "./utils/logger/logger.ts"
import { loadConfig } from "./utils/config/loader.ts"

const config = await loadConfig()
Logger.setLogLevel(config.logLevel)

const logger = new Logger("custos")

logger.info("Custos bot initializing...")
logger.info("Guild ID:", config.bot.guildId)
logger.info("Client ID:", config.bot.clientId)
logger.info("Check interval:", config.checkInterval, "hours")