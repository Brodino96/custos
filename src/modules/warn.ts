import { ApplicationCommandType, MessageFlags, REST, Routes, UserContextMenuCommandInteraction } from "discord.js"
import type { GuildMember, PartialGuildMember, Role } from "discord.js"
import { BotModule } from "./bot"
import Config from "../utils/config"
import { sql } from "bun"

export default class Warn extends BotModule {

    private readonly roles: Array<Role> = []
    private readonly checkInterval: number = Math.floor(Config.moderation.checkInterval * 1000 * 60 * 60)
    private readonly timeToRemove: number = Math.floor(Config.moderation.warn.expiresAfter * 60 * 60)

    async init(): Promise<void> {
        for (const roleId of Config.moderation.warn.rolesId) {
			const role = await this.bot.guild?.roles.fetch(roleId)
			if (role) {
				this.roles.push(role)
			}
		}

        this.registerCommands()

        if (!Config.moderation.warn.canExpire) {
            return
        }
        
		this.checkRoles()
		setInterval(() => {
			this.checkRoles()
		}, this.checkInterval)
    }

    private async registerCommands() {
        this.bot.client.application?.commands.create({
            name: "Remove Warn",
            type: ApplicationCommandType.User,
        })
        
        this.bot.client.application?.commands.create({
            name: "Warn",
            type: ApplicationCommandType.User,
        })
    }

    async contextInteraction(interaction: UserContextMenuCommandInteraction): Promise<void> {
        if (!interaction.isContextMenuCommand()) { return }

        const member = await interaction.guild?.members.fetch(interaction.user.id)

        if (!member || !this.bot.isModerator(member) || !member.permissions.has("Administrator")) {
            await interaction.reply({
                content: "You don't have permissions to use this command",
                flags: MessageFlags.Ephemeral
            })
            return
        }

        switch (interaction.commandName) {
            case "Warn":
                await this.addWarn(member, interaction)
                break

            case "Remove Warn":
                await this.removeWarn(member, interaction)
                break
        }
    }

    async memberJoined(member: GuildMember): Promise<void> {
        const count = sql`
            SELECT COUNT(*) AS warn_count
            FROM warn
            WHERE user_id = ${member.id}
        `
        console.log(count)
    }

    async memberLeft(member: GuildMember | PartialGuildMember): Promise<void> {
        return
    }

    private async removeWarn(member: GuildMember, interaction: UserContextMenuCommandInteraction) {
        const warns = await sql`
            DELETE FROM warn WHERE id = (
                SELECT id FROM warn WHERE user_id = ${member.id} ORDER BY given_at ASC LIMIT 1
            )
        `.catch(async (error) => {
            console.error("Failed to delete warn from the database", error)
            await interaction.reply({
                content: "Failed to remove warn",
                flags: MessageFlags.Ephemeral
            })
        })

        if (!warns) { return }
        
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
        const warns = await sql`
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
        `

        if (!warns) {
            if (interaction) {
                return await interaction.reply({
                    content: "Unable to add warn",
                    flags: MessageFlags.Ephemeral
                })
            }
        }
        
        const count = warns[0].count

        if (count == 0) {

            if (Config.moderation.warn.banAfterLimit) {
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
                member.roles.add(role)
                break
            }
        }

        await interaction.reply({
            content: "User warned",
            flags: MessageFlags.Ephemeral
        })
    }

    private async checkRoles() {
        const warnToRemove = await sql`
            WITH deleted_warns AS (
                DELETE FROM warn WHERE given_at <= NOW() - INTERVAL '${this.timeToRemove} seconds' RETURNING user_id
            )
            SELECT user_id, COUNT(*) FROM deleted_warns GROUP BY user_id
        `.catch((error) => {
            console.error("Failed to delete users from database", error)
        })

        if (warnToRemove.length <= 0) {
            return console.log("No warn are due to be removed")
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

        console.log("Warn removed for these players")
        console.log(players)
    }
}