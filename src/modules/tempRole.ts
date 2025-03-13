import { sql } from "bun"
import type { GuildMember, Role, Snowflake } from "discord.js"
import Config from "../utils/config"
import type Bot from "./bot"

export default class TempRole {
	private readonly bot: Bot
	private readonly roles: Array<Role> = []
	private readonly checkInterval: number = Math.floor(Config.tempRole.checkInterval * 1000 * 60 * 100)
	private readonly timeToRemove: number = Math.floor(Config.tempRole.roleDuration * 60 * 100)

	constructor(bot: Bot) {
		this.bot = bot

		if (!this.bot.guild) {
			console.error("Failed to get guild, gracefully crashing this shit")
			process.exit(1)
		}
	}

	// Creates the database tables and starts the checking process
	public async init() {
		for (const roleId of Config.tempRole.rolesId) {
			const role = await this.bot.guild?.roles.fetch(roleId)
			if (role) {
				this.roles.push(role)
			}
		}
		this.checkRoles()
		setInterval(() => {
			this.checkRoles()
		}, this.checkInterval)
	}

	// Saves user into database and adds the roles
	public async memberJoined(member: GuildMember) {
		console.log("Member joind")
		try {
			await sql`
                INSERT INTO temp_roles (user_id, created_at) 
                VALUES (${member.id}, NOW())
            `
		} catch (error) {
			console.error(`Failed to add user [${member.id}] into database`, error)
		}

		this.bot.addRoles(member, this.roles)
	}

	// Removes user from database
	public async memberLeft(userId: Snowflake) {
		try {
			await sql`
                DELETE FROM temp_roles WHERE user_id = ${userId}
            `
		} catch (error) {
			console.error(`Failed to remove user [${userId}] from database`, error)
		}
	}

	// Deletes all expired users from database and removes their roles
	private async checkRoles() {
		console.log("Checking roles")
		try {
			const deletedUsers = await sql`
                DELETE FROM temp_roles
                WHERE created_at < NOW() - INTERVAL '${this.timeToRemove} seconds'
                RETURNING user_id
            `
			
			for (const user of deletedUsers) {
				const member = await this.bot.guild?.members.fetch(user.user_id)
				if (!member) {
					return
				}
				this.bot.removeRoles(member, this.roles)
			}
		} catch (error) {
			console.error("Failed to delete users from database", error)
		}
	}
}
