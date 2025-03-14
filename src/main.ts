import { Bot } from "./modules/bot"
import TempRole from "./modules/tempRole"
import Config from "./utils/config"

class Main {
	private bot: Bot = new Bot()
	private tempRole: TempRole | undefined

	public async init() {

		if (Config.tempRole.enabled) {
			this.bot.addModule(TempRole)
		}

		await this.bot.login()
	}
}

new Main().init()
