import type { GuildMember, PartialGuildMember, ContextMenuCommandInteraction, Message, Role, Snowflake } from "discord.js"
import { BotModule } from "./bot"
import { tryCatch } from "typecatch"
import { sql } from "bun"
import Logger from "../utils/logger"

export default class switchingRoles extends BotModule {

    private readonly roles: Map<Snowflake, Array<Role>> = new Map()

    async init(): Promise<void> {

        for (const [ key, value ] of Object.entries(this.config.switchingRoles.roles)) {

            const afterRoles = []
            for (const afterRoleId of value) {
                const afterRole = await this.bot.guild?.roles.fetch(afterRoleId)
                if (!afterRole) {
                    Logger.warn(`switchingRoles: Failed to fetch role with id: ${afterRoleId}`)
                    continue
                }
                afterRoles.push(afterRole)
            }

            this.roles.set(key, afterRoles)

            Logger.success(`switchingRoles: Added roles [${key}, ${afterRoles.map(role => role.name)}] to list`)
        }

        this.bot.client.on("guildMemberUpdate", async (oldMember, newMember) => {
            this.guildMemberUpdate(oldMember, newMember)
        })

        this.checkRoles()
        setInterval(() => {
            this.checkRoles()
        }, Math.floor(this.config.checkInterval * 1000 * 60 * 60))
    }

    private async guildMemberUpdate(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember): Promise<void> {

        if (oldMember.roles.cache.size === newMember.roles.cache.size) {
            return
        }
        
        const addedRoles = newMember.roles.cache
            .filter(role => !oldMember.roles.cache.has(role.id))
            .map((role: Role) => role.id)

        for (const role of addedRoles) {
            if (this.roles.has(role)) {
                Logger.info(`switchingRoles: [${newMember.displayName}] recived a switchingRole`)
                const { error } = await tryCatch(sql`
                    INSERT INTO switching_roles (user_id, given_at, role_id)
                    VALUES (${newMember.id}, NOW(), ${role})
                `)
                    
                if (error) {
                    Logger.error(`switchingRoles: Failed to insert user [${newMember.displayName}] into the database, ${error}`)
                    continue
                }

                Logger.success(`switchingRoles: Added user [${newMember.displayName}]`)
            }
        }
    }

    /**
     * Periodically checks if switchingRoles are expired
     * @returns void
     */
    private async checkRoles() {

        Logger.info("switchingRoles: Checking...")
        
        const { data: deletedUsers, error } = await tryCatch(sql`
            DELETE FROM switching_roles
            WHERE given_at < NOW() - (${this.config.switchingRoles.duration} * INTERVAL '1 days')
            RETURNING user_id, role_id
        `)

        if (error) {
            Logger.error(`switchingRoles: Failed to delete users from database, ${error}`)
            return
        }

        if (!deletedUsers[0]) {
            return Logger.info("switchingRoles: No user has been deleted from the database")
        }

        Logger.info(`switchingRoles: Deleted users from database: \n${deletedUsers}`)
        
        for (const user of deletedUsers) {
            const { data: member, error } = await tryCatch(this.bot.guild!.members.fetch(user.user_id))
            
            if (error) { continue }

            if (!member) {
                Logger.error(`switchingRoles: Failed to fetch member [${user.user_id}], he probably left the server while the bot wasn't active`)
                continue
            }


            const roleToRemove = await this.bot.guild?.roles.fetch(user.role_id)
            if (!roleToRemove) {
                Logger.warn(`switchingRoles: Failed to fetch role with id: ${user.role_id}`)
                continue
            }
            
            await member.roles.remove(roleToRemove)
            await member.roles.add(this.roles.get(user.role_id)!)
            Logger.success(`switchingRoles: Removed roles for user [${member.displayName}]`)
        }
    }
    async memberJoined(member: GuildMember): Promise<void> {}
    async memberLeft(member: GuildMember | PartialGuildMember): Promise<void> {}
    async contextInteraction(interaction: ContextMenuCommandInteraction): Promise<void> {}
    async messageCreate(message: Message): Promise<void> {}
    
}