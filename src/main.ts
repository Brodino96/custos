import { Bot } from "./modules/bot"
import joinRoles from "./modules/joinRoles"
import loadConfig from "./utils/config"

class Main {
	public config = loadConfig()
	private bot: Bot = new Bot(this.config)

	public async init() {

		if (this.config.joinRoles.enabled) {
			this.bot.addModule(joinRoles)
		}


		await this.bot.init()
	}
}

new Main().init()
