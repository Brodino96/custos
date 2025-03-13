import { Client } from "discord.js"
import type { Guild, GuildMember, PartialGuildMember, Role } from "discord.js"
import Config from "../utils/config"

export default class Bot {
	public client: Client
	public guild: Guild | undefined

	constructor() {
		this.client = new Client({
			intents: [
				"Guilds", "GuildMessages", "GuildMembers", "DirectMessages", "MessageContent"
			],
		})
	}

	public async login() {
		await this.client.login(Config.token)
		await this.init()
	}

	private async init() {
		console.log(`Bot ready! Logged in as ${this.client.user?.tag}`)
		this.guild = await this.client.guilds.fetch(Config.guildId)
	}

	public async addRoles(member: GuildMember, roles: Array<Role>) {
		console.log(`Adding roles to ${member.id}`)
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
