import type { GuildMember, PartialGuildMember, ContextMenuCommandInteraction } from "discord.js";
import { BotModule } from "./botmodule";
import Logger from "../utils/logger";
import { tryCatch } from "typecatch";
import { sql } from "bun";
import Locale from "../utils/locale";

export default class PersistentRoles extends BotModule {

    private readonly moduleName = "PersistentRoles"
    private readonly logger = new Logger(this.moduleName)
    private readonly exeptions = new Set()

    public async init(): Promise<void> {
        this.logger.info("Initializing")
        for (const exileRole of this.baseConfig.exile.roles) {
            this.exeptions.add(exileRole)
        }
    }

    public async memberJoined(member: GuildMember): Promise<void> {
        const { data, error } = await tryCatch(sql<{ roles: string }[]>`
            SELECT roles FROM persistent_roles
            WHERE user_id = ${member.user.id}
            ORDER BY ABS(EXTRACT(EPOCH FROM given_at - NOW())) ASC
            LIMIT 1
        `)

        if (error) {
            return this.logger.error(Locale.generic.dbFailure)
        }

        if (data.length === 0) {
            return this.logger.info(`${member.user.username} never left the server`)
        }

        const roleIds = data[0].roles.split(",")
        const { error: addError } = await tryCatch(member.roles.add(roleIds))
        if (addError) {
            this.logger.error(`Failed to restore roles to ${member.user.username}, ${addError}`)
        }

        this.logger.success(`${member.user.username}'s roles restored`)
    }

    public async memberLeft(member: GuildMember | PartialGuildMember): Promise<void> {
        const roles = member.roles.cache
            .filter(role => role.id !== this.bot.guild.id && !role.managed && !this.exeptions.has(role.id))
            .map(role => role.id)

        const { error } = await tryCatch(sql`
            INSERT INTO persistent_roles (user_id, given_at, roles)
            VALUES (${member.user.id}, NOW(), ${roles})
        `)

        if (error) {
            return this.logger.error(`${Locale.generic.dbFailure}, ${error}`)
        }

        this.logger.info(`Successfully saved ${member.user.username}'s roles: (${roles})`)
    }

    public async contextInteraction(interaction: ContextMenuCommandInteraction, source: GuildMember): Promise<void> {}
    
}