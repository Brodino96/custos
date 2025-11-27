import { type GuildMember, type PartialGuildMember, type ContextMenuCommandInteraction, ApplicationCommandType, type CacheType } from "discord.js"
import { BotModule } from "./botmodule"
import Logger from "../utils/logger"
import { tryCatch } from "typecatch"
import { sql } from "bun"
import Locale from "../utils/locale"

export default class Warn extends BotModule {

    private readonly config = this.baseConfig.warn
    private readonly logger = new Logger("Warn")

    /**
     * Initializes the module
     */
    public async init(): Promise<void> {
        this.logger.info("Initializing module")
        this.registerCommands()
    }

    /**
     * Registers commands
     */
    private async registerCommands(): Promise<void> {
        await Promise.all([
            this.bot.guild.commands.create({
                name: "Warn add",
                type: ApplicationCommandType.User
            }),
            
            this.bot.guild.commands.create({
                name: "Warn remove",
                type: ApplicationCommandType.User
            })
        ])

        this.logger.success("Registered commands")
    }

    /**
     * Gets called whenever and interaction is used (commands)
     * @param interaction 
     * @param source The member that used the interaction
     */
    public async contextInteraction(interaction: ContextMenuCommandInteraction, source: GuildMember): Promise<void> {
        if (interaction.isContextMenuCommand()) {
            this.onContextCommand(interaction)
        }
    }

    /**
     * Called when the command type it's a user context interaction (right click - app)
     * @param interaction
     * @returns
     */
    private async onContextCommand(interaction: ContextMenuCommandInteraction) {
        switch (interaction.commandName) {
            case "Warn add": break
            case "Warn remove": break
            default: return
        }

        const targetMember = await this.bot.guild.members.fetch(interaction.targetId)
        if (!targetMember) {
            await this.bot.reply(interaction, Locale.generic.noTarget)
            return this.logger.error("Target member is null")
        }

        this.logger.info(`Command target: ${targetMember.user.username}`)

        switch (interaction.commandName) {
            case "Warn add":
                await this.addWarn(targetMember, interaction)
                break
            case "Warn remove":
                await this.removeWarn(targetMember, interaction)
                break
        }
    }

    private async addWarn(target: GuildMember, interaction: ContextMenuCommandInteraction) {
        if (await this.bot.isModerator(target)) {
            await this.bot.reply(interaction, `⛔ <@${target.user.id}> is a moderator`)
            return this.logger.info(`Stopping because ${target.user.username} is a moderator`)
        }

        this.logger.info(`${interaction.user.username} requested ${target.user.username} warn add`)
        const { data, error } = await tryCatch(sql<{ count: number }[]>`
            SELECT COUNT(*) AS count FROM warns WHERE user_id = ${target.id} AND active = TRUE
        `)

        if (error) {
            await this.bot.reply(interaction, Locale.generic.dbFailure)
            return this.logger.error(`${Locale.generic.dbFailure}, ${error}`)
        }

        if (data[0].count >= this.config.roles.length) {
            await this.bot.reply(interaction, `⛔ <@${target.user.id}> already has the maximum amount of warns`)
            return this.logger.info(`${target.user.username} already has the maximum amount of warns`)
        }

        for (const warnRole of this.config.roles) {
            if (target.roles.cache.has(warnRole)) {
                continue
            }

            await target.roles.add(warnRole)

            const { error } = await tryCatch(sql`
                INSERT INTO warns (user_id, active, given_at)
                VALUES (${target.user.id}, TRUE, NOW())
            `)
            if (error) {
                await this.bot.reply(interaction, Locale.generic.dbFailure)
                return this.logger.error(`${Locale.generic.dbFailure}, ${error}`)
            }

            await this.bot.reply(interaction, `✅ <@${target.user.id}> has been warned`)

            return
        }

    }

    private async removeWarn(targetMember: GuildMember, interaction: ContextMenuCommandInteraction<CacheType>) {
        if (await this.bot.isModerator(targetMember)) {
            await this.bot.reply(interaction, `⛔ <@${targetMember.user.id}> is a moderator`)
            return this.logger.info(`Stopping because ${targetMember.user.username} is a moderator`)
        }

        this.logger.info(`${interaction.user.username} requested ${targetMember.user.username} warn removal`)

        const { data: activeWarns, error: countError } = await tryCatch(sql<{ count: number }[]>`
            SELECT COUNT(*) AS count FROM warns WHERE user_id = ${targetMember.id} AND active = TRUE
        `)

        if (countError) {
            await this.bot.reply(interaction, Locale.generic.dbFailure)
            return this.logger.error(`${Locale.generic.dbFailure}, ${countError}`)
        }

        if (activeWarns[0].count == 0) {
            await this.bot.reply(interaction, `⛔ <@${targetMember.user.id}> has no active warns to remove`)
            return this.logger.info(`${targetMember.user.username} has no active warns to remove`)
        }

        const { error: updateError } = await tryCatch(sql`
            UPDATE warns SET active = FALSE WHERE ID = (
                SELECT ID FROM warns WHERE user_id = ${targetMember.user.id} AND active = TRUE ORDER BY ID LIMIT 1
        )`)

        if (updateError) {
            await this.bot.reply(interaction, Locale.generic.dbFailure)
            return this.logger.error(`${Locale.generic.dbFailure}, ${updateError}`)
        }

        for (let i = this.config.roles.length - 1; i >= 0; i--) {
            const warnRole = this.config.roles[i]
            if (targetMember.roles.cache.has(warnRole)) {
                await targetMember.roles.remove(warnRole)
                break
            }
        }

        await this.bot.reply(interaction, `✅ Removed one warn from <@${targetMember.user.id}>`)
        this.logger.success(`Successfully removed warn from ${targetMember.user.username}`)
    }


    public async memberJoined(member: GuildMember): Promise<void> {
        const { data, error } = await tryCatch(sql<{}[]>`
            SELECT FROM warns WHERE user_id = ${member.user.id} AND active = TRUE
        `)

        if (error) {
            return this.logger.error(`${Locale.generic.dbFailure}, ${error}`)
        }

        if (data.length === 0) {
            return this.logger.info(`${member.user.username} is not warned`)
        }

        for (let i = 0; i < data.length; i++) {
            member.roles.add(this.config.roles[i])
        }

        this.logger.info(`Restored warns roles for ${member.user.username}`)
    }

    public async memberLeft(member: GuildMember | PartialGuildMember): Promise<void> {}
}