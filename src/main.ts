import { Bot } from "./modules/bot"
import joinRoles from "./modules/joinRoles"
import switchingRoles from "./modules/switchingRoles"
import Warns from "./modules/warns"
import PersistentRoles from "./modules/persistentRoles"
import loadConfig from "./utils/config"

class Main {
	public config = loadConfig()
	private bot: Bot = new Bot(this.config)

	public async init() {

		if (this.config.joinRoles.enabled) {
			this.bot.addModule(joinRoles)
		}

		if (this.config.moderation.warn.enabled) {
			this.bot.addModule(Warns)
		}

		if (this.config.switchingRoles.enabled) {
			this.bot.addModule(switchingRoles)
		}

		if (this.config.persistentRoles.enabled) {
			this.bot.addModule(PersistentRoles)
		}

		await this.bot.init()
	}
}

new Main().init()
