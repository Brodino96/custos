import { sql } from "bun"
import type { ContextMenuCommandInteraction, GuildMember, PartialGuildMember, Role } from "discord.js"
import { BotModule } from "../bot"
import { tryCatch } from "typecatch"
import Logger from "../utils/logger"

export default class joinRoles extends BotModule {

	private readonly config = this.baseConfig.joinRoles
	private readonly moduleName = "JoinRoles"
	private readonly logger = new Logger(this.moduleName)
	private roles: Role[] = []

	public async init() {

		this.roles = await this.bot.getRoles(this.config.roles, this.moduleName)
	
		if (!this.config.expires) {
			return this.logger.info("Expiry is disabled")
		}

		this.checkRoles()
		setInterval(() => {
			this.checkRoles()
		}, Math.floor(this.bot.checkInterval))
	}

	public async memberJoined(member: GuildMember) {
		const { error } = await tryCatch(sql`
			INSERT INTO join_roles (user_id, given_at)
			VALUES (${member.id}, NOW())
		`)

		if (error) {
			return this.logger.error(`Failed to insert user: [${member.user.username}] into database, ${error}`)
		}

		await member.roles.add(this.roles)
		this.logger.success(`Roles succesfully added to user: ${member.user.globalName}`)
	}

	public async memberLeft(member: GuildMember | PartialGuildMember) {
		const { error } = await tryCatch(sql`
			DELETE FROM join_roles WHERE user_id = ${member.id}`
		)

		if (error) {
			return this.logger.error(`Failed to removed user: [${member.user.globalName}] from database, ${error}`)
		}

		this.logger.success(`Removed user: [${member.user.globalName}] from database`)
	}

	private async checkRoles() {
		this.logger.info("Checking database...")

		const { data: deletedUsers, error } = await tryCatch(sql`
			DELETE FROM join_roles
			WHERE given_at < NOW() - (${this.config.duration} * INTERVAL '1 days')
			RETURNING user_id
		`)

		if (error) {
			return this.logger.error(`Failed to fetch users from database, ${error}`)
		}

		if (!deletedUsers[0]) {
			return this.logger.info(`No user has been deleted from the database`)
		}

		this.logger.info(`Deleted users from database: \n${deletedUsers}`)
		
		for (const user of deletedUsers) {
			const { data: member, error } = await tryCatch(this.bot.guild!.members.fetch(user.user_id))

			if (error || !member) {
				this.logger.error(`Failed to fetch member [${user.user_id}], he probably left the server while the bot wasn't active`)
				continue
			}

			await member.roles.remove(this.roles)
			this.logger.success(`Removed roles for user [${member.user.globalName}]`)
		}
	}

	async contextInteraction(interaction: ContextMenuCommandInteraction): Promise<void> {}
}
