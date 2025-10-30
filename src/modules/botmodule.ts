import type { ContextMenuCommandInteraction, GuildMember, PartialGuildMember } from "discord.js"
import type { Bot } from "../bot"
import type { ConfigType } from "../utils/config"
import type { MethodOf } from "../utils/types/methodof"

export type BotModuleMethod = MethodOf<BotModule>

export abstract class BotModule {
	
	protected bot: Bot
	protected baseConfig: ConfigType

	constructor(bot: Bot, config: ConfigType) {
		this.bot = bot
		this.baseConfig = config
	}

	abstract init(): Promise<void>

	abstract memberJoined(member: GuildMember): Promise<void>
	abstract memberLeft(member: GuildMember | PartialGuildMember): Promise<void>
	abstract contextInteraction(interaction: ContextMenuCommandInteraction): Promise<void>
}