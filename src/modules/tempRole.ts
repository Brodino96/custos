import { sql } from "bun"
import type { ContextMenuCommandInteraction, GuildMember, PartialGuildMember, Role } from "discord.js"
import Config from "../utils/config"
import { BotModule } from "./bot"
import { tryCatch } from "../utils/trycatch"
import Logger from "../utils/logger"

const logger = new Logger()

export default class TempRole extends BotModule {
	async contextInteraction(interaction: ContextMenuCommandInteraction): Promise<void> {}

	private readonly roles: Array<Role> = []
	private readonly checkInterval: number = Math.floor(Config.tempRole.checkInterval * 1000 * 60 * 100)

	// Creates the database tables and starts the checking process
	public async init() {
		for (const roleId of Config.tempRole.rolesId) {
			const role = await this.bot.guild?.roles.fetch(roleId)
			if (role) {
				this.roles.push(role)
				logger.info(`Role: [${role.name}] added to tempRole list`)
			}
		}
		this.checkRoles()
		setInterval(() => {
			this.checkRoles()
		}, this.checkInterval)
	}

	// Saves user into database and adds the roles
	public async memberJoined(member: GuildMember) {
		const { error } = await tryCatch(sql`
			INSERT INTO temp_roles (user_id, created_at) 
			VALUES (${member.id}, NOW())
		`)

		if (error) {
			logger.error(`Failed to remove user [${member.id}] from database: ${error}`)
			return
		}

		await member.roles.add(this.roles)
		logger.success(`tempRoles added to user ${member.id}`)
	}

	// Removes user from database
	public async memberLeft(member: GuildMember | PartialGuildMember) {
		const { error } = await tryCatch(sql`DELETE FROM temp_roles WHERE user_id = ${member.id}`)

		if (error) {
			logger.error(`Failed to remove user [${member.id}] from database: ${error}`)
			return
		}

		logger.success(`User: ${member.id} from database (tempRoles)`)
	}

	// Deletes all expired users from database and removes their roles
	private async checkRoles() {
		logger.info("Check new players")

		const { data, error: aaa } = await tryCatch(sql`
			SELECT * FROM temp_roles
			WHERE created_at < NOW() - INTERVAL '${0} hours'
		`)

		console.log(data)

		const { data: deletedUsers, error } = await tryCatch(sql`
			DELETE FROM temp_roles
			WHERE created_at < NOW() - INTERVAL '${Config.tempRole.roleDuration} hours'
			RETURNING user_id
		`)

		console.log(deletedUsers)

		if (error) {
			logger.error(`Failed to delete users from database, ${error}`)
			return
		}

		for (const user of deletedUsers) {
			const member = await this.bot.guild?.members.fetch(user.user_id)
			if (!member) {
				logger.error("User is somehow null")
				return
			}
			logger.info(`Removing new member roles for user: ${member.displayName}`)
			await member.roles.remove(this.roles)
		}
	}
}
