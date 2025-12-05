import type { CommandInteraction, GuildMember, PartialGuildMember } from "discord.js"
import type { Bot } from "../bot"
import type { ConfigType } from "../utils/config"
import type { MethodOf } from "../utils/types/methodof"

export type BotModuleMethod = MethodOf<BotModule>

/**
 * This is the base for every module of this discord bot
 */
export abstract class BotModule {
	
	/**
	 * The bot itself
	 */
	protected bot: Bot
	/**
	 * The complete config file
	 */
	protected baseConfig: ConfigType

	constructor(bot: Bot, config: ConfigType) {
		this.bot = bot
		this.baseConfig = config
	}

	/**
	 * Entrypoint for the module
	 */
	abstract init(): Promise<void>

	/**
	 * Called every time someone joins your guild
	 * @param member The discord member
	 */
	abstract memberJoined(member: GuildMember): Promise<void>

	/**
	 * Called every time someone leaves your guild
	 * @param member Thhe discord member
	 */
	abstract memberLeft(member: GuildMember | PartialGuildMember): Promise<void>

	/**
	 * Called every time an interaction (command/context) is used
	 * @param interaction The interaction
	 * @param source The user that triggered the interaction
	 */
	abstract contextInteraction(interaction: CommandInteraction, source: GuildMember): Promise<void>
}