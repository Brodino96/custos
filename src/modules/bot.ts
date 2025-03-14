import { Client } from "discord.js"
import type { Guild, GuildMember, PartialGuildMember, Role } from "discord.js"
import Config from "../utils/config"

export class Bot {
	public client: Client
	public guild: Guild | undefined
	public modules: BotModule[] = []

	constructor() {
		this.client = new Client({
			intents: ["Guilds", "GuildMessages", "GuildMembers", "DirectMessages", "MessageContent"],
		})
	}

	public async login() {
		await this.client.login(Config.token)
		await this.init()
		this.callModuleMethod("init")
	}

	private async init() {
		console.log(`Bot ready! Logged in as ${this.client.user?.tag}`)
		this.guild = await this.client.guilds.fetch(Config.guildId)
		this.handleEvents()
	}

	// private callModuleMethod<T extends BotModuleMethod>(methodName: T, ...args:Parameters<BotModule[T]>): Promise<Awaited<ReturnType<BotModule[T]>>[]> {
	// 	return Promise.all(this.modules.map(module => module[methodName].apply(module, args) as ReturnType<BotModule[T]>))
	// }

	/**
	 * This is cursed, do not try and modify this shit
	 * It has a mind of his own
	 * This is the type of shit Microsoft sniffs before releasing another low tier Xbox
	 */
	private callModuleMethod<T extends BotModuleMethod>(methodName: T, ...args:Parameters<BotModule[T]>): Promise<Awaited<ReturnType<BotModule[T]>>[]> {
		return Promise.all(
			this.modules.map(module => {
				// This explicit casting helps TypeScript understand how to apply the arguments
				const method = module[methodName] as (...methodArgs: Parameters<BotModule[T]>) => ReturnType<BotModule[T]>;
				return method.apply(module, args) as ReturnType<BotModule[T]>;
			})
		);
	  }

	public async addModule(module: new (bot: Bot) => BotModule) {
		this.modules.push(new module(this))
	}

	private handleEvents() {
		this.client.on("guildMemberAdd", async (member: GuildMember) => {
			this.callModuleMethod("memberJoined", member)
		})

		this.client.on("guildMemberRemove", async (member: GuildMember | PartialGuildMember) => {
			this.callModuleMethod("memberLeft", member)
		})
	}

	public async addRoles(member: GuildMember, roles: Array<Role>) {
		for (const role of roles) {
			member.roles.add(role)
		}
	}

	public async removeRoles(member: GuildMember | PartialGuildMember, roles: Array<Role>) {
		for (const role of roles) {
			member.roles.remove(role)
		}
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
}

type MethodOf<T> = {
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	[K in keyof T]: T[K] extends (...args: any[]) => any ? K : never;
}[keyof T]

type BotModuleMethod = MethodOf<BotModule>