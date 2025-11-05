import { User, ApplicationCommandType, ModalBuilder, TextInputStyle, TextInputBuilder, ActionRowBuilder } from "discord.js"
import type { GuildMember, PartialGuildMember, ContextMenuCommandInteraction, Role, ModalSubmitInteraction, Snowflake } from "discord.js"
import { BotModule } from "./botmodule"
import Logger from "../utils/logger"
import Locale from "../utils/locale"
import { sql } from "bun"
import { tryCatch } from "typecatch"

export default class Exile extends BotModule {
    
    private readonly config = this.baseConfig.exile
    private readonly logger = new Logger("Exile")
    
    /**
     * Initializes the module
     */
    public async init(): Promise<void> {
        this.logger.info("Initializing module")
        this.registerCommands()

        this.logger.info("Initializing loop")
        this.loop()
        setInterval(() => {
            this.loop()
        }, this.bot.checkInterval)
    }

    /**
     * Loops every tot time to check expired exiles
     * @returns
     */
    private async loop(): Promise<void> {
        const { data, error } = await tryCatch(sql<{ user_id: Snowflake, roles: string }[]>`
            UPDATE exiles SET active = FALSE
            WHERE active = TRUE AND expires_at < NOW()
            RETURNING user_id, roles
        `)

        if (error) {
            return this.logger.error(Locale.generic.dbFailure)
        }

        if (data.length == 0) {
            return this.logger.info("No exile expired")
        }

        for (const user of data) {
            const member = await this.bot.guild.members.fetch(user.user_id)
            if (!member) {
                continue
            }
            const roleIds = user.roles.split(",")
            
            const { error: roleUpdateError } = await tryCatch(member.roles.set(roleIds, "Exile expired"))
            if (roleUpdateError) {
                this.logger.error(`Failed to restore roles for: ${member.user.username}, ${roleUpdateError}`)
            }
            
            this.logger.success(`${member.user.username}'s exile expired`)
        }
    }
    
    /**
     * Registers commands
     */
    private async registerCommands(): Promise<void> {
        await Promise.all([
            this.bot.guild.commands.create({
                name: "Exile add",
                type: ApplicationCommandType.User
            }),

            this.bot.guild.commands.create({
                name: "Exile remove",
                type: ApplicationCommandType.User
            }),

            this.bot.guild.commands.create({
                name: "Exile info",
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

        if (interaction.isModalSubmit()) {
            this.onModalSumbit(interaction)
        }       
    }

    /**
     * Called when the command type it's a user context interaction (right click - app)
     * @param interaction
     * @returns
     */
    private async onContextCommand(interaction: ContextMenuCommandInteraction): Promise<void> {
        switch (interaction.commandName) {
            case "Exile add": break
            case "Exile remove": break
            case "Exile info": break
            default: return
        }

        const targetMember = await this.bot.guild.members.fetch(interaction.targetId)
        if (!targetMember) {
            await this.bot.reply(interaction, Locale.generic.noTarget)
            return this.logger.error("Target member is null")
        }

        this.logger.info(`Command target: ${targetMember.user.username}`)

        switch (interaction.commandName) {
            case "Exile info":
                await this.requestExileInfo(targetMember.user, interaction)
                break
            case "Exile add":
                await this.requestExileAdd(targetMember, interaction)
                break
            case "Exile remove":
                await this.requestExileRemove(targetMember, interaction)
                break
        }
    }

    /**
     * Inizializes the process of exiling a user
     * @param target The member to be exiled
     * @param interaction 
     * @returns 
     */
    private async requestExileAdd(target: GuildMember, interaction: ContextMenuCommandInteraction) {
        if (await this.bot.isModerator(target)) {
            await this.bot.reply(interaction, `⛔ <@${target.user.id}> is a moderator`)
            return this.logger.info(`Stopping because ${target.user.username} is a moderator`)
        }

        this.logger.info(`${interaction.user.username} requested ${target.user.username} exile add`)
        const { data, error } = await tryCatch(sql<{}[]>`
            SELECT FROM exiles WHERE user_id = ${target.id} AND active = TRUE
        `)

        if (error) {
            await this.bot.reply(interaction, Locale.generic.dbFailure)
            return this.logger.error(Locale.generic.dbFailure)
        }

        if (data.length > 0) {
            await this.bot.reply(interaction, `⛔ <@${target.user.id}> is already exiled`)
            return this.logger.info(`${target.user.username} is already exiled`)
        }

        const modal = new ModalBuilder()
            .setCustomId(`custos-exile-modal-${target.id}`)
            .setTitle(`Exile ${target.user.username}`)

        const reasonInput = new TextInputBuilder()
            .setCustomId("reason")
            .setLabel("Reason for exile")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Enter your reason here...")
            .setRequired(true)

        const durationInput = new TextInputBuilder()
            .setCustomId("duration")
            .setLabel("Duration (in days, leave empty for permanent)")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Example: 7")
            .setRequired(false)

        const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput)
        const secondRow = new ActionRowBuilder<TextInputBuilder>().addComponents(durationInput)

        modal.addComponents(firstRow, secondRow)

        this.logger.info(`Showing modal to ${interaction.user.username}`)

        await interaction.showModal(modal)
    }
    
    /**
     * Triggered when modal is sumbitted
     * @param interaction 
     * @returns 
     */
    private async onModalSumbit(interaction: ModalSubmitInteraction): Promise<void> {
        if (!interaction.customId.startsWith("custos-exile-modal-")) {
            return
        }

        const targetId = interaction.customId.split("-")[3]
        const reason = interaction.fields.getTextInputValue("reason")
        const durationRaw = interaction.fields.getTextInputValue("duration")

        const durationDays = durationRaw.trim() === "" ? null : parseInt(durationRaw, 10)

        if (durationRaw && (!durationDays || durationDays < 0)) {
            await this.bot.reply(interaction, `⛔ ${durationDays} is an invalid number of days`)
            return this.logger.info(`${interaction.user.username} put an invalid number of days (${durationDays})`)
        }

        const targetMember = await this.bot.guild.members.fetch(targetId)
        if (!targetMember) {
            await this.bot.reply(interaction, `⛔ <@${targetId}> doesn't exists`)
            return this.logger.error(`Failed to fetch user with id ${targetId}`)
        }

        this.logger.info(`Modal sumbitted by ${interaction.user.username} to exile ${targetMember.user.username} for ${durationDays} days`)

        const now = new Date()
        const expiresAt = durationDays !== null
            ? new Date(now.setDate(now.getDate() + durationDays)).toISOString()
            : null
        
        const targetRoles = targetMember.roles.cache
            .filter(role => role.id !== this.bot.guild.id && !role.managed)
            .map(role => role.id)

        this.logger.info(`${targetMember.user.username} has this roles: ${targetMember.roles.cache.map(role => role.name)}`)
        
        const { error } = await tryCatch(sql`
            INSERT INTO exiles (user_id, reason, active, given_at, expires_at, roles)
            VALUES (${targetId}, ${reason}, TRUE, NOW(), ${expiresAt}, ${targetRoles})
        `)

        if (error) {
            await this.bot.reply(interaction, Locale.generic.dbFailure)
            return this.logger.error(`${Locale.generic.dbFailure}, ${error}`)
        }

        const { error: roleUpdateError } = await tryCatch(targetMember.roles.set(this.config.roles, "Exiled"))
        if (roleUpdateError) {
            this.logger.error(`Failed to update roles for: ${targetMember.user.username}, ${roleUpdateError}`)
        }

        await this.bot.reply(interaction, durationDays
            ? `🕒 <@${targetId}> will be exiled for **${durationDays} days**.\nReason: ${reason}`
            : `⛔ <@${targetId}> will be **permanently exiled**.\nReason: ${reason}`,
        )
        this.logger.success(`Successfully exiled the user: ${targetMember.user.username}, for ${durationDays} days, Reason: ${reason}`)
    }

    /**
     * Inizialies the process of removing an exile
     * @param target The target
     * @param interaction 
     * @returns 
     */
    private async requestExileRemove(target: GuildMember, interaction: ContextMenuCommandInteraction) {
        this.logger.info(`${interaction.user.username} requested ${target.user.username} exile removal`)
        const { data, error } = await tryCatch(sql<{ roles: string }[]>`
            UPDATE exiles SET active = FALSE
            WHERE user_id = ${target.user.id} AND active = TRUE
            RETURNING roles
        `)

        if (error) {
            await this.bot.reply(interaction, Locale.generic.dbFailure)
            return this.logger.error(`${Locale.generic.dbFailure}, ${error}`)
        }

        if (data.length == 0) {
            await this.bot.reply(interaction, `⛔ <@${target.user.id}> is not exiled`)
            return this.logger.info(`${target.user.username} is not exiled`)
        }

        this.logger.info(`Restoring roles to ${target.user.username}: ${data[0].roles}`)

        const { error: roleUpdateError } = await tryCatch(target.roles.set(data[0].roles.split(","), "Manually readmitted"))
        if (roleUpdateError) {
            this.logger.error(`Failed to update roles for: ${target.user.username}, ${roleUpdateError}`)
        }

        await this.bot.reply(interaction, `✅ <@${target.user.id}> has been readmitted`)
        this.logger.info(`${target.user.username} has been readmitted`)
    }

    /**
     * Inizializes the process of getting exile infos
     * @param user The target
     * @param interaction 
     * @returns 
     */
    private async requestExileInfo(user: User, interaction: ContextMenuCommandInteraction) {
        this.logger.info(`${interaction.user.username} requested ${user.username} exile infos`)
        const { data, error } = await tryCatch(sql<{ reason: string, given_at: Date, expires_at: Date | null }[]>`
            SELECT reason, given_at, expires_at FROM exiles WHERE user_id = ${user.id} AND active = TRUE
        `)

        if (error) {
            await this.bot.reply(interaction, Locale.generic.dbFailure)
            return this.logger.error(`${Locale.generic.dbFailure}, ${error}`)
        }

        if (data.length == 0) {
            await this.bot.reply(interaction, `⛔ <@${user.id}> is not exiled`)
            return this.logger.info(`${user.username} is not exiled`)
        }

        this.logger.info(`${user.username} is exiled`)
        this.logger.info(`Reason: ${data[0].reason}`)
        this.logger.info(`Since: ${data[0].reason}`)
        this.logger.info(`Until: ${data[0].expires_at}`)
        
        await this.bot.reply(interaction, `User <@${user.id}> is exiled:\n📒 **Reason**: ${data[0].reason},\n🕛 **Since**: ${data[0].given_at},\n📅 **Until**: ${data[0].expires_at}`)
    }

    public async memberJoined(member: GuildMember): Promise<void> {
        const { data, error } = await tryCatch(sql<{}[]>`
            SELECT FROM exiles WHERE user_id = ${member.user.id} AND active = TRUE
        `)

        if (error) {
            return this.logger.error(`${Locale.generic.dbFailure}, ${error}`)
        }

        if (data.length === 0) {
            return this.logger.info(`${member.user.username} is not exiled`)
        }

        await tryCatch(member.roles.add(this.config.roles))
        this.logger.info(`Restored exile roles for ${member.user.username}`)
    }

    public async memberLeft(member: GuildMember | PartialGuildMember): Promise<void> {}
}