import { Client } from "discord.js"
import type { Guild, GuildMember, PartialGuildMember, Role } from "discord.js"
import Config from "../utils/config"

export default class Bot {
	public client: Client
	public guild: Guild | undefined

	constructor() {
		this.client = new Client({
			intents: ["Guilds", "GuildMessages", "GuildMembers", "DirectMessages", "MessageContent"],
		})

		this.client.once("ready", async () => {
			this.init()
		})

		this.client.login(Config.token)
	}

	private async init() {
		console.log(`Bot ready! Logged in as ${this.client.user?.tag}`)
		this.guild = this.client.guilds.cache.get(Config.guildId)
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
