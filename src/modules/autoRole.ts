import type { GuildMember, PartialGuildMember, ContextMenuCommandInteraction, Message, Role } from "discord.js";
import { BotModule } from "./bot";
import Config from "../utils/config";
import logger from "../utils/logger";
import { tryCatch } from "typecatch";
import { sql } from "bun";

export default class AutoRole extends BotModule {
    
    private readonly checkInterval: number = Math.floor(Config.autoTempRole.interval * 1000 * 60 * 100)
    private readonly roles: { before: Array<Role>, after: Array<Role>} = {
        before: [],
        after: []
    }
    
    async init(): Promise<void> {

        for (const beforeRole of Config.autoTempRole.roles.before) {
            const role = await this.bot.guild?.roles.fetch(beforeRole)
            if (role) {
                this.roles.before.push(role)
                logger.info(`Role: [${role.name}] added to autoTempRole before list`)
            }
        }
        
        for (const afterRole of Config.autoTempRole.roles.after) {
            const role = await this.bot.guild?.roles.fetch(afterRole)
            if (role) {
                this.roles.after.push(role)
                logger.info(`Role: [${role.name}] added to autoTempRole after list`)
            }
        }

        this.checkRoles()
		setInterval(() => {
			this.checkRoles()
		}, this.checkInterval)
    }

    async messageCreate(message: Message): Promise<void> {
        if (message.channelId != Config.autoTempRole.channel) {
            return
        }

        const member = await this.bot.guild?.members.fetch(message.author.id)

        if (!member) { return }

        if (member.user.createdAt > new Date('2024-12-01T00:00:00Z')) {
            message.react("🟥")
            return
        }

        await member.roles.add(this.roles.before)
        message.react("🟩")

        const { error } = await tryCatch(sql`
            INSERT INTO auto_temp_roles (user_id, added_at) 
            VALUES (${member.id}, NOW())
        `)
    }

    private async checkRoles() {

		const { data: deletedUsers, error } = await tryCatch(sql`
			DELETE FROM auto_temp_roles
			WHERE added_at < NOW() - INTERVAL '${Config.autoTempRole.duration} hours'
			RETURNING user_id
		`)

		if (error) {
			logger.error(`Failed to delete users from database, ${error}`)
			return
		}

		for (const user of deletedUsers) {
            const { data: member, error } = await tryCatch(this.bot.guild!.members.fetch(user.user_id))
			//const member = await this.bot.guild?.members.fetch(user.user_id)
			if (!member) {
				logger.error("User is somehow null")
				return
			}
			logger.info(`Removing auto temp roles for user: ${member.displayName}`)
			await member.roles.remove(this.roles.before)

            logger.info(`Adding auto temp roles for user: ${member.displayName}`)
            await member.roles.add(this.roles.after)
		}
	}

    async memberLeft(member: GuildMember | PartialGuildMember): Promise<void> {
        const { error } = await tryCatch(sql`DELETE FROM auto_temp_roles WHERE user_id = ${member.id}`)

        if (error) {
            logger.error(`Failed to remove user [${member.id}] from database: ${error}`)
            return
        }

        logger.success(`User: ${member.id} from database (autoTempRoles)`)
    }

    async memberJoined(member: GuildMember): Promise<void> {}
    async contextInteraction(interaction: ContextMenuCommandInteraction): Promise<void> {}    
}