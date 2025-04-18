import { ApplicationCommandType, MessageFlags, UserContextMenuCommandInteraction } from "discord.js"
import type { GuildMember, Message, PartialGuildMember, Role, Snowflake } from "discord.js"
import { BotModule } from "./bot"
import Config from "../utils/config"
import { sql } from "bun"
import { tryCatch } from "../utils/trycatch"
import logger from "../utils/logger"

export default class Warn extends BotModule {

    private readonly roles: Array<Role> = []
    private readonly checkInterval: number = Math.floor(Config.moderation.checkInterval * 1000 * 60 * 60)

    async init(): Promise<void> {
        for (const roleId of Config.moderation.warn.rolesId) {
			const role = await this.bot.guild?.roles.fetch(roleId)
			if (role) {
				this.roles.push(role)
			}
		}

        this.registerCommands()

        if (!Config.moderation.warn.canExpire) {
            logger.info("Warn expire is deactivated")
            return
        }
        
		this.checkRoles()
		setInterval(() => {
			this.checkRoles()
		}, this.checkInterval)
    }

    private async registerCommands() {
        this.bot.guild?.commands.create({
            name: "Remove Warn",
            type: ApplicationCommandType.User,
        })

        this.bot.guild?.commands.create({
            name: "Add Warn",
            type: ApplicationCommandType.User,
        })
    }

    async contextInteraction(interaction: UserContextMenuCommandInteraction): Promise<void> {
        if (!interaction.isContextMenuCommand()) { return }

        const member = await this.bot.guild?.members.fetch(interaction.user.id)

        if (!member) {
            logger.error("User is null")
            await interaction.reply({
                content: "Somehow you are not a user????",
                flags: MessageFlags.Ephemeral
            })
            return
        }

        logger.info(`Command used by ${member.id}`)

        const targetMember = await this.bot.guild?.members.fetch(interaction.targetId)

        if (!targetMember) {
            logger.error("Target member is null")
            await interaction.reply({
                content: "Target member does not exists",
                flags: MessageFlags.Ephemeral
            })
            return
        }

        logger.info(`Target member is: ${targetMember.displayName}`)

        if (!this.bot.isModerator(member) || !member.permissions.has("Administrator")) {
            logger.error(`User does not have permissions`)
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
            default:
                console.log("aaaaaaaaaaaaaaaaa")
        }
    }

    async memberJoined(member: GuildMember): Promise<void> {

        const { data, error } = await tryCatch(sql`
            SELECT COUNT(*) AS warn_count
            FROM warn
            WHERE user_id = ${member.id}
        `)

        if (error) {
            logger.error("Error fetching data from database")
        }

        const numberOfWarns = parseInt(data[0].warn_count)

        logger.info(`${member.displayName} joined with ${numberOfWarns} warn`)

        if (numberOfWarns == 0) {
            logger.info("Player had now warns")
            return
        }

        for (const role of this.roles) {
            for (let i = 0; i < numberOfWarns; i++) {
                await member.roles.add(role)
            }

        }
    }

    private async removeWarn(member: GuildMember, interaction: UserContextMenuCommandInteraction) {

        const { data: warns, error } = await tryCatch(sql`
            DELETE FROM warn WHERE id = (
                SELECT id FROM warn WHERE user_id = ${member.id} ORDER BY given_at ASC LIMIT 1
            )
        `)

        if (error) {
            logger.error(`Failed to delete warn from the database ${error}`)
            await interaction.reply({
                content: "Failed to remove warn",
                flags: MessageFlags.Ephemeral
            })
        }

        if (!warns) {
            logger.info("User has no warn")
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

    private async addWarn(member: GuildMember, interaction: UserContextMenuCommandInteraction) {

        const { data: warns, error } = await tryCatch(sql`
            WITH warn_count AS (
                SELECT COUNT(*) AS count FROM warn WHERE user_id = ${member.id}
            ), inserted AS (
                INSERT INTO warn (user_id)
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
            console.log("Failed to add warn")
            return await interaction.reply({
                content: "Unable to add warn",
                flags: MessageFlags.Ephemeral
            })
        }
        
        const count = warns[0].count

        if (count == 0) {

            if (Config.moderation.warn.banAfterLimit) {
                await this.removeDatabaseWarns(member.id)
                await member.ban({ reason: Config.moderation.warn.banMessage })
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

    private async removeDatabaseWarns(id: Snowflake) {
        const { error } = await tryCatch(sql`
            DELETE FROM warn WHERE user_id = ${id}
        `)

        if (error) {
            logger.error(`Failed to delete warns from database for user ${id}`)
        }
    }

    private async checkRoles() {

        logger.info("Checking warns")

        const { data: warnToRemove, error } = await tryCatch(sql`
            WITH deleted_warns AS (
                DELETE FROM warn WHERE given_at <= NOW() - INTERVAL '${Config.moderation.warn.expiresAfter} hours' RETURNING user_id
            )
            SELECT user_id, COUNT(*) FROM deleted_warns GROUP BY user_id
        `)

        if (error) {
            logger.error(`Failed to delete users from database ${error}`)
            return
        }

        if (warnToRemove.length <= 0) {
            logger.info("No warn are due to be removed")
            return
        }

        let players = ""

        for (const warn of warnToRemove) {
            const member = await this.bot.guild?.members.fetch(warn.user_id)
            if (!member) { return console.error("Failed to fetch member") }

            const rolesToRemove = this.roles.filter(role => member.roles.cache.has(role.id)).slice(0, Number(warn.count))
            if (rolesToRemove.length > 0) {
                await member.roles.remove(rolesToRemove, "Warn expired")
            }
            players += `${member.displayName} (${member.user.username}), `
        }

        logger.info("Warned removed for these players")
        logger.info(players)
    }

    async messageCreate(message: Message): Promise<void> {}
    async memberLeft(member: GuildMember | PartialGuildMember): Promise<void> {}
}