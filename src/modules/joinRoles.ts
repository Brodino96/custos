import { sql } from "bun"
import type { ContextMenuCommandInteraction, GuildMember, PartialGuildMember, Role } from "discord.js"
import { BotModule } from "./bot"
import { tryCatch } from "typecatch"
import Logger from "../utils/logger"

export default class joinRoles extends BotModule {

	private readonly roles: Array<Role> = []

	public async init() {

		for (const roleId of this.config.joinRoles.roles) {
			const role = await this.bot.guild?.roles.fetch(roleId)
			if (!role) {
				Logger.warn(`joinRoles: Failed to fetch role with id: ${roleId}`)
				continue
			}
			this.roles.push(role)
			Logger.success(`joinRoles: Added role [${role.name}] to list`)
		}

		if (!this.config.joinRoles.expires) {
			return Logger.info("joinRoles: Expiry is disabled")
		}

		this.checkRoles()
		setInterval(() => {
			this.checkRoles()
		}, Math.floor(this.config.checkInterval * 1000 * 60 * 60))
	}

	/**
	 * Adds joinRoles when joining the server
	 * @param member The user that joined the discord
	 * @returns void
	 */
	public async memberJoined(member: GuildMember) {

		const { error } = await tryCatch(sql`
			INSERT INTO joinRoles (user_id, given_at)
			VALUES (${member.id}, NOW())
		`)

		if (error) {
			return Logger.error(`joinRoles: Failed to insert user [${member.displayName}] into the database, ${error}`)
		}

		await member.roles.add(this.roles)
		Logger.success(`joinRoles: Added to user ${member.displayName}`)
	}

	/**
	 * Removes joinRoles when leaving the server
	 * @param member the user that left the discord
	 * @returns void
	 */
	public async memberLeft(member: GuildMember | PartialGuildMember) {
		const { error } = await tryCatch(sql`DELETE FROM joinRoles WHERE user_id = ${member.id}`)

		if (error) {
			Logger.error(`joinRoles: Failed to remove user [${member.displayName}] from database: ${error}`)
			return
		}

		Logger.success(`joinRoles: Removed user [${member.displayName}] from database`)
	}

	/**
	 * Periodically checks if the joinRoles are expired
	 * @returns void
	 */
	private async checkRoles() {

		Logger.info("joinRoles: Checking...")

		const { data: deletedUsers, error } = await tryCatch(sql`
			DELETE FROM joinRoles
			WHERE given_at < NOW() - INTERVAL '${this.config.joinRoles.duration} days'
			RETURNING user_id
		`)

		if (error) {
			return Logger.error(`joinRoles: Failed to delete users from database, ${error}`)
		}
		

		if (!deletedUsers[0]) {
			return Logger.info("joinRoles: No user has been deleted from the database")
		}

		Logger.info(`joinRoles: Deleted users from database: \n${deletedUsers}`)
		
		for (const user of deletedUsers) {
			const { data: member, error } = await tryCatch(this.bot.guild!.members.fetch(user.user_id))

			if (error) {
				continue
			}

			if (!member) {
				Logger.error(`joinRoles: Failed to fetch member [${user.user_id}], he probably left the server while the bot wasn't active`)
				continue
			}

			await member.roles.remove(this.roles)
			Logger.success(`joinRoles: Removed roles for user [${member.displayName}]`)
		}
	}

	async contextInteraction(interaction: ContextMenuCommandInteraction): Promise<void> {}
}
