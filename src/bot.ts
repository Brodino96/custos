import { Client } from "discord.js"
import type { ContextMenuCommandInteraction, Guild, GuildMember, PartialGuildMember, Role } from "discord.js"
import type { BotModule, BotModuleMethod } from "./modules/botmodule"
import type { ConfigType } from "./utils/config"
import { tryCatch } from "typecatch"
import Logger from "./utils/logger"

export class Bot {

	public config: ConfigType
	private logger: Logger
	public client: Client
	public guild!: Guild
	public modules: BotModule[] = []
	public checkInterval: number

	constructor(config: ConfigType) {
		this.config = config
		this.logger = new Logger("Bot")
		this.checkInterval = Math.floor(this.config.checkInterval * 1000 * 60 * 60)
		this.client = new Client({
			intents: ["Guilds", "GuildMessages", "GuildMembers", "MessageContent"],
		})
	}

	public async init() {

		const { error: loginError } = await tryCatch(this.client.login(this.config.bot.token))
		if (loginError) {
			this.logger.error(`Failed to login: ${loginError}`)
			return process.exit(0)
		}

		this.logger.success(`Bot ready! Logged in as ${this.client.user?.tag}`)
		
		const { data: guild, error: guildError } = await tryCatch(this.client.guilds.fetch(this.config.bot.guildId))
		if (guildError) {
			this.logger.error(`Failed to fetch the guild with id: ${this.config.bot.guildId}, ${guildError}`)
			return process.exit(0)
		}

		this.guild = guild

		this.callModule("init")
		this.registerEvents()
	}

	private registerEvents() {

		this.client.on("guildMemberAdd", async (member: GuildMember) => {
			this.logger.info(`Member [${member.user.displayName}] joined the server`)
			this.callModule("memberJoined", member)
		})

		this.client.on("guildMemberRemove", async (member: GuildMember | PartialGuildMember) => {
			this.logger.info(`Member [${member.user.displayName}] left the server`)
			this.callModule("memberLeft", member)
		})

		//@ts-ignore
		this.client.on("interactionCreate", async (interaction: ContextMenuCommandInteraction) => {
			this.callModule("contextInteraction", interaction)
		})
	}

	/**
	 * Checks if the user is a moderator
	 * @param member 
	 * @returns 
	 */
	public async isModerator(member: GuildMember | PartialGuildMember) {
		for (const role of this.config.bot.moderatorRoles) {
			if (member.roles.cache.has(role)) {
				return true
			}
		}

		if (member.permissions.has("Administrator")) {
			return true
		}
		
		return false
	}

	public async getRoles(rolesList: Readonly<string[]>, source: string): Promise<Role[]> {
		const roles: Role[] = []
		for (const roleId of rolesList) {
			const role = await this.guild.roles.fetch(roleId)
			if (!role) {
				this.logger.error(`Failed to fetch role with id: [${roleId}] from module: [${source}]`)
				continue
			}
			roles.push(role)
		}
		return roles
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
	public async addModule(module: new (bot: Bot, config: ConfigType) => BotModule) {
		this.modules.push(new module(this, this.config))
	}

}