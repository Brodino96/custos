import type { GuildMember, PartialGuildMember, ContextMenuCommandInteraction, Message, Role } from "discord.js"
import { BotModule } from "./bot"
import Config from "../utils/config"
import { tryCatch } from "typecatch"
import { sql } from "bun"
import logger from "../utils/logger"

export default class ManualRole extends BotModule {

    private readonly checkInterval: number = Math.floor(Config.manualRole.interval * 1000 * 60 * 100)
        private readonly roles: { before: Array<Role>, after: Array<Role>} = {
        before: [],
        after: []
    }

    async init(): Promise<void> {

        for (const beforeRole of Config.manualRole.roles.before) {
            const role = await this.bot.guild?.roles.fetch(beforeRole)
            if (role) {
                this.roles.before.push(role)
                logger.info(`Role: [${role.name}] added to manualRoles before list`)
            }
        }
        
        for (const afterRole of Config.manualRole.roles.after) {
            const role = await this.bot.guild?.roles.fetch(afterRole)
            if (role) {
                this.roles.after.push(role)
                logger.info(`Role: [${role.name}] added to manualRoles after list`)
            }
        }

        this.bot.client.on("guildMemberUpdate", async (oldMember, newMember) => {
            if (oldMember.roles.cache.size === newMember.roles.cache.size) {
                return
            }
            
            const addedRoles = newMember.roles.cache.filter(
                role => !oldMember.roles.cache.has(role.id)
            )

            const matched = addedRoles.filter(
                role => this.roles.before.some((b) => b.id === role.id)
            )

            if (matched.size) {
                const { error } = await tryCatch(sql`
                    INSERT INTO manual_roles (user_id, added_at) 
                    VALUES (${newMember.id}, NOW())
                `)
            }
        })

        this.checkRoles()
        setInterval(() => {
            this.checkRoles()
        }, this.checkInterval)
    }

    private async checkRoles() {
        
        const { data: deletedUsers, error } = await tryCatch(sql`
            DELETE FROM manual_roles
            WHERE added_at < NOW() - INTERVAL '${Config.manualRole.duration} hours'
            RETURNING user_id
        `)

        if (error) {
            logger.error(`Failed to delete users from database, ${error}`)
            return
        }

        for (const user of deletedUsers) {
            const { data: member, error } = await tryCatch(this.bot.guild!.members.fetch(user.user_id))
            if (!member || error) {
                logger.error("User is null")
                return
            }

            await member.roles.remove(this.roles.before)
            await member.roles.add(this.roles.after)
        }
    }
    async memberJoined(member: GuildMember): Promise<void> {}
    async memberLeft(member: GuildMember | PartialGuildMember): Promise<void> {}
    async contextInteraction(interaction: ContextMenuCommandInteraction): Promise<void> {}
    async messageCreate(message: Message): Promise<void> {}
    
}