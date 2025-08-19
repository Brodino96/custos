import type { ContextMenuCommandInteraction, GuildMember, PartialGuildMember } from "discord.js"
import { BotModule } from "./bot"
import { sql } from "bun"
import { tryCatch } from "typecatch"
import Logger from "../utils/logger"

export default class PersistentRoles extends BotModule {

    public async init() {
        if (!this.config.persistentRoles.enabled) {
            return Logger.info("persistentRoles: Module disabled")
        }
        Logger.success("persistentRoles: Module initialized")
    }

    async memberJoined(member: GuildMember): Promise<void> {
        if (!this.config.persistentRoles.enabled) return

        const { data, error } = await tryCatch(sql`
            SELECT roles FROM persistent_roles WHERE user_id = ${member.id}
        `)

        if (error) {
            return Logger.error(`persistentRoles: Failed to fetch roles for user ${member.displayName}: ${error}`)
        }

        if (!data[0]) {
            return Logger.info(`persistentRoles: No stored roles found for ${member.displayName}`)
        }

        const roleIds: string[] = JSON.parse(data[0].roles)
        
        if (roleIds.length === 0) {
            return Logger.info(`persistentRoles: User ${member.displayName} had no roles to restore`)
        }

        const rolesToAdd = []
        for (const roleId of roleIds) {
            const role = await this.bot.guild?.roles.fetch(roleId)
            if (role) {
                rolesToAdd.push(role)
            } else {
                Logger.warn(`persistentRoles: Role ${roleId} no longer exists, skipping`)
            }
        }

        if (rolesToAdd.length > 0) {
            const { error: addError } = await tryCatch(member.roles.add(rolesToAdd, "Restoring persistent roles"))
            if (addError) {
                Logger.error(`persistentRoles: Failed to add roles to ${member.displayName}: ${addError}`)
            } else {
                Logger.success(`persistentRoles: Restored ${rolesToAdd.length} roles to ${member.displayName}`)
            }
        }

        const { error: deleteError } = await tryCatch(sql`
            DELETE FROM persistent_roles WHERE user_id = ${member.id}
        `)

        if (deleteError) {
            Logger.error(`persistentRoles: Failed to clean up stored roles for ${member.displayName}: ${deleteError}`)
        }
    }

    async memberLeft(member: GuildMember | PartialGuildMember): Promise<void> {
        if (!this.config.persistentRoles.enabled) return

        if (!member.roles || member.partial) {
            return Logger.warn(`persistentRoles: Cannot save roles for ${member.user?.displayName}, member data incomplete`)
        }

        const warnRoleIds = this.config.moderation.warn.roles
        const allRoles = member.roles.cache
        
        const rolesToSave = allRoles
            .filter(role => !warnRoleIds.includes(role.id))
            .filter(role => role.id !== this.bot.guild?.id)
            .map(role => role.id)

        if (rolesToSave.length === 0) {
            return Logger.info(`persistentRoles: No roles to save for ${member.user?.displayName}`)
        }

        const { error: upsertError } = await tryCatch(sql`
            INSERT INTO persistent_roles (user_id, roles)
            VALUES (${member.id}, ${JSON.stringify(rolesToSave)})
            ON CONFLICT (user_id) DO UPDATE SET
                roles = EXCLUDED.roles
        `)

        if (upsertError) {
            Logger.error(`persistentRoles: Failed to save roles for ${member.user?.displayName}: ${upsertError}`)
        } else {
            Logger.success(`persistentRoles: Saved ${rolesToSave.length} roles for ${member.user?.displayName}`)
        }
    }

    async contextInteraction(_interaction: ContextMenuCommandInteraction): Promise<void> {}
}