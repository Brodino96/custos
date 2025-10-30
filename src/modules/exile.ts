import { MessageFlags, ApplicationCommandOptionType, ChatInputCommandInteraction, User, ApplicationCommandType, ModalBuilder, TextInputStyle, TextInputBuilder, ActionRowBuilder, ActionRow } from "discord.js"
import type { GuildMember, PartialGuildMember, ContextMenuCommandInteraction, Role, ModalSubmitInteraction } from "discord.js"
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
    
    public async init(): Promise<void> {
        this.logger.info(`Initializing ${this.moduleName}`)
        this.roles = await this.bot.getRoles(this.config.roles, this.moduleName)
        this.registerCommands()
    }
    
    private async registerCommands() {
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

    private async onCommandUse(interaction: ContextMenuCommandInteraction): Promise<void> {
        switch (interaction.commandName) {
            case "Exile add": break
            case "Exile remove": break
            case "Exile info": break
            default: return
        }

        const member = await this.bot.guild.members.fetch(interaction.user.id)

        if (!member) {
            await interaction.reply({
                content: Locale.noSource,
                flags: MessageFlags.Ephemeral
            })
            return this.logger.error("Command user is null")
        }

        if (!this.bot.isModerator(member)) {
            await interaction.reply({
                content: Locale.noPermission,
                flags: MessageFlags.Ephemeral
            })
            return this.logger.warn("Command user is not a moderator")
        }

        const targetMember = await this.bot.guild.members.fetch(interaction.targetId)

        if (!targetMember) {
            this.logger.error("Target member is null")
            await interaction.reply({
                content: Locale.noTarget,
                flags: MessageFlags.Ephemeral
            })
            return
        }

        switch (interaction.commandName) {
            case "Exile info":
                await this.getInfo(targetMember.user, interaction)
                break
            case "Exile add":
                await this.exileUser(targetMember, interaction)
                break
        }
    }
    
    private async exileUser(target: GuildMember, interaction: ContextMenuCommandInteraction) {
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
            .setPlaceholder("example: 7")
            .setRequired(false)

        const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput)
        const secondRow = new ActionRowBuilder<TextInputBuilder>().addComponents(durationInput)

        modal.addComponents(firstRow, secondRow)

        await interaction.showModal(modal)
    }
    
    private async onModalSumbit(interaction: ModalSubmitInteraction): Promise<void> {
        if (!interaction.customId.startsWith("custos-exile-modal-")) {
            return
        }

        const targetId = interaction.customId.split("-")[3]
        const reason = interaction.fields.getTextInputValue("reason")
        const durationRaw = interaction.fields.getTextInputValue("duration")

        const durationDays = durationRaw.trim() === "" ? null : parseInt(durationRaw, 10)

        if (durationRaw && (!durationDays || durationDays < 0)) {
            await interaction.reply({
                content: "Invalid number of days. Please enter a valid number or leave it blank",
                flags: MessageFlags.Ephemeral
            })
            return
        }

        const targetMember = await this.bot.guild.members.fetch(targetId)
        if (!targetMember) {
            await interaction.reply({
                content: Locale.noTarget,
                flags: MessageFlags.Ephemeral
            })
            return this.logger.error("Failed to fetch discord user")
        }

        const expiresAt = durationDays !== null
            ? `NOW() + (${durationDays} || ' days')::interval`
            : null

        const targetRoles = targetMember.roles.cache
            .map(role => role.id)
        
        const { error } = await tryCatch(sql`
            INSERT INTO exiles (user_id, reason, active, given_at, expires_at, roles)
            VALUES (${targetId}, ${reason}, TRUE, NOW(), ${expiresAt}, ${targetRoles})
        `)

        if (error) {
            await interaction.reply({
                content: "Failed to update database",
                flags: MessageFlags.Ephemeral
            })
            return this.logger.error(`Failed to update database, ${error}`)
        }

        await targetMember.roles.remove(targetMember.roles.cache)
        await targetMember.roles.add(this.roles)

        await interaction.reply({
            content: durationDays
                ? `🕒 <@${targetId}> will be exiled for **${durationDays} days**.\nReason: ${reason}`
                : `⛔ <@${targetId}> will be **permanently exiled**.\nReason: ${reason}`,
            flags: MessageFlags.Ephemeral
        })
    }

    private async getInfo(user: User, interaction: ContextMenuCommandInteraction) {
        const { data, error } = await tryCatch(sql`
            SELECT reason, given_at FROM exiles WHERE user_id = ${user.id} AND active = TRUE
        `)

        if (error) {
            await interaction.reply({
                content: "Failed to fetch info from the database",
                flags: MessageFlags.Ephemeral
            })
            return this.logger.error(`Failed to get exile info from the database, ${error}`)
        }

        const info = data[0]

        if (info == null) {
            await interaction.reply({
                content: "User has not been exiled",
                flags: MessageFlags.Ephemeral
            })
            return this.logger.warn("Target user is not exiled")
        }
        
        await interaction.reply({
            content: `User has been banned for reason: ${info["reason"]}\nin date: ${info["given_at"]}`,
            flags: MessageFlags.Ephemeral
        })
    }


    public async contextInteraction(interaction: ContextMenuCommandInteraction): Promise<void> {
        if (interaction.isContextMenuCommand()) {
            this.onCommandUse(interaction)
        }

        if (interaction.isModalSubmit()) {
            this.onModalSumbit(interaction)
        }       
    }

    public async memberJoined(member: GuildMember): Promise<void> {}
    public async memberLeft(member: GuildMember | PartialGuildMember): Promise<void> {}
}