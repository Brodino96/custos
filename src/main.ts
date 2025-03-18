import { Bot } from "./modules/bot"
import TempRole from "./modules/tempRole"
import Warn from "./modules/warn"
import Config from "./utils/config"

class Main {
	private bot: Bot = new Bot()

	public async init() {

		if (Config.tempRole.enabled) {
			this.bot.addModule(TempRole)
		}

		if (Config.moderation.enabled) {
			this.bot.addModule(Warn)
		}

		await this.bot.login()
	}
}

new Main().init()
