import { Client } from "discord.js"
import type { ContextMenuCommandInteraction, Guild, GuildMember, Message, PartialGuildMember } from "discord.js"
import type { BotModuleMethod } from "../utils/types/botmodule"
import Config from "../utils/config"
import logger from "../utils/logger"

export class Bot {
	public client: Client
	public guild: Guild | undefined
	public modules: BotModule[] = []

	constructor() {
		this.client = new Client({
			intents: ["Guilds", "GuildMessages", "GuildMembers", "MessageContent"],
		})
	}

	public async init() {
		await this.client.login(Config.token)
		console.log(`Bot ready! Logged in as ${this.client.user?.tag}`)
		this.guild = await this.client.guilds.fetch(Config.guildId)

		this.callModule("init")

		this.registerEvents()
	}

	private registerEvents() {
		this.client.on("guildMemberAdd", async (member: GuildMember) => {
			logger.info(`Member [${member.id}] joined`)
			this.callModule("memberJoined", member)
		})

		this.client.on("guildMemberRemove", async (member: GuildMember | PartialGuildMember) => {
			this.callModule("memberLeft", member)
		})

		//@ts-ignore
		this.client.on("interactionCreate", async (interaction: ContextMenuCommandInteraction) => {
			this.callModule("contextInteraction", interaction)
		})
	}

	public async isModerator(member: GuildMember | PartialGuildMember) {
		let toReturn = false
		for (const role of Config.moderation.roles) {
			if (member.roles.cache.has(role)) {
				toReturn = true
				break
			}
		}
		return toReturn
	}

	/**
	 * This is cursed, do not try and modify this shit  
	 * It has a mind of his own  
	 * This is the type of shit Microsoft sniffs before releasing another low tier Xbox
	 */
	private callModule<T extends BotModuleMethod>(methodName: T, ...args:Parameters<BotModule[T]>): Promise<Awaited<ReturnType<BotModule[T]>>[]> {
		return Promise.all(
			this.modules.map(module => {
				// This explicit casting helps TypeScript understand how to apply the arguments
				const method = module[methodName] as (...methodArgs: Parameters<BotModule[T]>) => ReturnType<BotModule[T]>
				return method.apply(module, args) as ReturnType<BotModule[T]>;
			})
		)
	}

	/**
	 * Adds a module to the bot  
	 * Ask [Dreaming-Codes](https://github.com/Dreaming-Codes) if you want to know how it works
	 */
	public async addModule(module: new (bot: Bot) => BotModule) {
		this.modules.push(new module(this))
	}
}

export abstract class BotModule {
	protected bot: Bot

	constructor(bot: Bot) {
		this.bot = bot
	}

	abstract init(): Promise<void>

	abstract memberJoined(member: GuildMember): Promise<void>
	abstract memberLeft(member: GuildMember | PartialGuildMember): Promise<void>
	abstract contextInteraction(interaction: ContextMenuCommandInteraction): Promise<void>
	abstract messageCreate(message: Message): Promise<void>
}