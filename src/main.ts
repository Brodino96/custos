import type { GuildMember, PartialGuildMember } from "discord.js"
import Bot from "./modules/bot"
import TempRole from "./modules/tempRole"

class Main {
	private bot: Bot = new Bot()
	private tempRole: TempRole | undefined

	public async init() {

		await this.bot.login()
		this.tempRole = new TempRole(this.bot)
		await this.tempRole.init()
		
		this.bot.client.on("guildMemberAdd", (member: GuildMember) => {
			this.tempRole?.memberJoined(member)
		})

		this.bot.client.on("guildMemberRemove", (member: GuildMember | PartialGuildMember) => {
			this.tempRole?.memberLeft(member.id)
		})
	}
}

new Main().init()
