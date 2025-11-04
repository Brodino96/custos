import { MessageFlags, User, ApplicationCommandType, ModalBuilder, TextInputStyle, TextInputBuilder, ActionRowBuilder } from "discord.js"
import type { GuildMember, PartialGuildMember, ContextMenuCommandInteraction, Role, ModalSubmitInteraction, Snowflake } from "discord.js"
import { BotModule } from "./botmodule"
import Logger from "../utils/logger"
import Locale from "../utils/locale"
import { sql } from "bun"
import { tryCatch } from "typecatch"

export default class Exile extends BotModule {
    
    private readonly config = this.baseConfig.exile
    private readonly moduleName = "Exile"
    private readonly logger = new Logger(this.moduleName)
    private roles: Role[] = []
    
    /**
     * Initializes the module
     */
    public async init(): Promise<void> {
        this.roles = await this.bot.getRoles(this.config.roles, this.moduleName)
        this.logger.info(`Initializing ${this.moduleName}`)
        this.registerCommands()

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
            const role = user.roles.split(",")
            await tryCatch(member.roles.add(role))
            await tryCatch(member.roles.remove(this.roles))
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
        
        this.logger.success(`Registered commands`)
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

        const now = new Date()
        const expiresAt = durationDays !== null
            ? new Date(now.setDate(now.getDate() + durationDays)).toISOString()
            : null
        
        const targetRoles = targetMember.roles.cache
            .filter(role => role.id !== this.bot.guild.id && !role.managed)
            .map(role => role.id)
        
        const { error } = await tryCatch(sql`
            INSERT INTO exiles (user_id, reason, active, given_at, expires_at, roles)
            VALUES (${targetId}, ${reason}, TRUE, NOW(), ${expiresAt}, ${targetRoles})
        `)

        if (error) {
            await this.bot.reply(interaction, Locale.generic.dbFailure)
            return this.logger.error(`${Locale.generic.dbFailure}, ${error}`)
        }

        await tryCatch(targetMember.roles.remove(targetMember.roles.cache))
        await tryCatch(targetMember.roles.add(this.roles))

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

        await tryCatch(target.roles.add(data[0].roles.split(",")))
        await tryCatch(target.roles.remove(this.roles))

        await this.bot.reply(interaction, `✅ @<${target.user.id}> has been readmitted with roles ${data[0].roles}`)
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
            await this.bot.reply(interaction, `⛔ <@${user.id}> has not been exiled`)
            return this.logger.info(`${user.username} is not exiled`)
        }
        
        this.logger.info(`${user.username} is exiled, Reason: ${data[0].reason}, In Date: ${data[0].given_at}, Until: ${data[0].expires_at}`)
        await this.bot.reply(interaction, `User <@${user.id}> is exiled:\n📒 **Reason**: ${data[0].reason},\n🕛 **In date**: ${data[0].given_at},\n📅 **Until**: ${data[0].expires_at}`)
    }

    public async memberJoined(member: GuildMember): Promise<void> {}
    public async memberLeft(member: GuildMember | PartialGuildMember): Promise<void> {}
}