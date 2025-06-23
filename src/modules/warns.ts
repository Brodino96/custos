import { ApplicationCommandType, MessageFlags, UserContextMenuCommandInteraction } from "discord.js"
import type { GuildMember, Message, PartialGuildMember, Role, Snowflake } from "discord.js"
import { BotModule } from "./bot"
import Config from "../utils/config"
import { sql } from "bun"
import { tryCatch } from "typecatch"
import logger from "../utils/logger"
import Logger from "../utils/logger"

export default class Warns extends BotModule {

    private readonly roles: Array<Role> = []

    public async init() {

        for (const roleId of this.config.moderation.warn.roles) {
            const role = await this.bot.guild?.roles.fetch(roleId)
            if (!role) {
                Logger.warn(`warns: Failed to fetch role with id: ${roleId}`)
                continue
            }
            this.roles.push(role)
            Logger.success(`warns: Added role [${role.name}] to list`)
        }

        this.registerCommands()

        if (!this.config.moderation.warn.canExpire) {
            return Logger.info(`warns: Warn expiry disabled`)
        }
        
		this.checkRoles()
		setInterval(() => {
			this.checkRoles()
		}, Math.floor(this.config.checkInterval * 1000 * 60 * 60))
    }

    /**
     * Registers the commands to give or remove warns
     */
    private async registerCommands() {
        this.bot.guild?.commands.create({
            name: "Remove Warn",
            type: ApplicationCommandType.User,
        })
        
        this.bot.guild?.commands.create({
            name: "Add Warn",
            type: ApplicationCommandType.User,
        })

        Logger.info("warns: Registered commands")
    }

    /**
     * Handles the use of the commands
     * @param interaction discord.js stuff
     * @returns void
     */
    public async contextInteraction(interaction: UserContextMenuCommandInteraction): Promise<void> {
        if (!interaction.isContextMenuCommand()) { return }

        const member = await this.bot.guild?.members.fetch(interaction.user.id)

        if (!member) {
            Logger.error(`warns: Command user is null`)
            await interaction.reply({
                content: "Somehow you are not a user????",
                flags: MessageFlags.Ephemeral
            })
            return
        }

        Logger.info(`Command used by ${member.displayName}`)

        const targetMember = await this.bot.guild?.members.fetch(interaction.targetId)

        if (!targetMember) {
            Logger.error("warns: Target member is null")
            await interaction.reply({
                content: "Target member does not exists",
                flags: MessageFlags.Ephemeral
            })
            return
        }

        Logger.info(`Target member is: ${targetMember.displayName}`)

        if (!this.bot.isModerator(member) || !member.permissions.has("Administrator")) {
            Logger.error(`warns: Command user does not have permissions`)
            await interaction.reply({
                content: "You don't have permissions to use this command",
                flags: MessageFlags.Ephemeral
            })
            return
        }

        //TODO Save commands id to do this switch
        switch (interaction.commandName) {
            case "Add Warn":
                await this.addWarn(targetMember, interaction)
                break

            case "Remove Warn":
                await this.removeWarn(targetMember, interaction)
                break
        }
    }

    /**
     * Removes a warns to a user
     * @param member the user
     * @param interaction discord.js stuff
     * @returns void
     */
    private async removeWarn(member: GuildMember, interaction: UserContextMenuCommandInteraction) {

        const { data: warns, error } = await tryCatch(sql`
            DELETE FROM warns WHERE id = (
                SELECT id FROM warns WHERE user_id = ${member.id} ORDER BY given_at ASC LIMIT 1
            )
        `)

        if (error) {
            Logger.error(`warns: Failed to delete warn from the database, ${error}`)
            await interaction.reply({
                content: "Failed to remove warn",
                flags: MessageFlags.Ephemeral
            })
        }

        if (!warns) {
            Logger.info(`warns: User [${member.displayName}] had no warns`)
            await interaction.reply({
                content: "User has no warn",
                flags: MessageFlags.Ephemeral
            })
            return
        }
        
        for (const role of this.roles) {
            if (member.roles.cache.has(role.id)) {
                await member.roles.remove(role)
                await interaction.reply({
                    content: "Warn removed",
                    flags: MessageFlags.Ephemeral
                })
                break
            }
        }
    }

    /**
     * Adds a warns to a user
     * @param member the user
     * @param interaction discord.js stuff
     * @returns void
     */
    private async addWarn(member: GuildMember, interaction: UserContextMenuCommandInteraction) {

        const { data: warns, error } = await tryCatch(sql`
            WITH warn_count AS (
                SELECT COUNT(*) AS count FROM warns WHERE user_id = ${member.id}
            ), inserted AS (
                INSERT INTO warns (user_id)
                SELECT ${member.id}
                WHERE (SELECT count FROM warn_count) < ${this.roles.length}
                RETURNING 1
            )
            SELECT CASE
                WHEN (SELECT count FROM warn_count) >= ${this.roles.length} THEN 0
                ELSE (SELECT count FROM warn_count) + 1
            END AS count
        `)

        if (error) {
            Logger.error(`warns: Failed to add warn, ${error}`)
            return await interaction.reply({
                content: "Unable to add warn",
                flags: MessageFlags.Ephemeral
            })
        }
        
        const count = warns[0].count

        if (count == 0) {

            if (this.config.moderation.warn.ban.enabled) {
                await this.removeDatabaseWarns(member.id)
                await member.ban({ reason: this.config.moderation.warn.ban.banMessage})
                await interaction.reply({
                    content: "Max number of warn reached, user banned",
                    flags: MessageFlags.Ephemeral
                })
            } else {
                await interaction.reply({
                    content: "Max number of warn reached! Unable to assign another",
                    flags: MessageFlags.Ephemeral
                })
            }
            return
        }

        for (const role of this.roles) {
            if (!member.roles.cache.has(role.id)) {
                await member.roles.add(role)
                break
            }
        }

        await interaction.reply({
            content: "User warned",
            flags: MessageFlags.Ephemeral
        })
    }

    /**
     * Removed all warns for a specific user
     * @param id user id
     * @returns void
     */
    private async removeDatabaseWarns(id: Snowflake) {
        const { error } = await tryCatch(sql`
            DELETE FROM warns WHERE user_id = ${id}
        `)

        if (error) {
            return Logger.error(`warns: Failed to delete warns from database for user ${id}, ${error}`)
        }
    }

    /**
     * Checks if user had any warn
     * @param member 
     * @returns 
     */
    async memberJoined(member: GuildMember): Promise<void> {

        const { data, error } = await tryCatch(sql`
            SELECT COUNT(*) AS warn_count
            FROM warns
            WHERE user_id = ${member.id}
        `)

        if (error) {
            return Logger.error("warns: Failed to fetch data from database")
        }

        const numberOfWarns = parseInt(data[0].warn_count)

        Logger.info(`${member.displayName} has ${numberOfWarns} warn`)

        if (numberOfWarns == 0) {
            return
        }

        for (const role of this.roles) {
            for (let i = 0; i < numberOfWarns; i++) {
                await member.roles.add(role)
            }

        }
    }

    /**
     * Periodically checks if the warns are expired
     * @returns void
     */
    private async checkRoles() {

        Logger.info(`warns: Checking...`)

        const { data: warnToRemove, error } = await tryCatch(sql`
            WITH deleted_warns AS (
                DELETE FROM warns WHERE given_at <= NOW() - INTERVAL '${this.config.moderation.warn.expiresAfter} days' RETURNING user_id
            )
            SELECT user_id, COUNT(*) FROM deleted_warns GROUP BY user_id
        `)

        if (error) {
            return Logger.error(`warns: Failed to delete users from database, ${error}`)
        }

        if (warnToRemove.length <= 0) {
            return Logger.info("warns: No warn are due to be removed")
        }

        let players = ""

        for (const warn of warnToRemove) {
            const { data: member, error } = await tryCatch(this.bot.guild!.members.fetch(warn.user_id))
            if (error) { continue }
            
            if (!member) {
                Logger.error(`warns: Failed to fetch member [${warn.user_id}], he probably left the server while the bot wasn't active`)
                continue
            }

            const rolesToRemove = this.roles.filter(role => member.roles.cache.has(role.id)).slice(0, Number(warn.count))
            if (rolesToRemove.length > 0) {
                await member.roles.remove(rolesToRemove, "Warn expired")
            }
            players += `${member.displayName} (${member.user.username}), `
        }

        Logger.info(`warns: Removed warns for the players:\n${players}`)
    }

    async messageCreate(message: Message): Promise<void> {}
    async memberLeft(member: GuildMember | PartialGuildMember): Promise<void> {}
}