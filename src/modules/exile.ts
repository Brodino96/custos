import { type GuildMember, type PartialGuildMember, type ContextMenuCommandInteraction, type Role, ApplicationCommandType, MessageFlags, ApplicationCommandOptionType, ChatInputCommandInteraction, User } from "discord.js";
import { BotModule } from "./bot"
import Logger from "../utils/logger";
import Locale from "../utils/locale";
import { sql } from "bun";
import { tryCatch } from "typecatch";

export default class Exile extends BotModule {
    
    private readonly roles: Role[] = []
    private commandNames: String[] = []
    
    public async init(): Promise<void> {

        for (const roleId of this.config.moderation.exile.roles) {
            const role = await this.bot.guild?.roles.fetch(roleId)
            if (!role) {
                Logger.warn(`ban: Failed to fetch role with id: ${roleId}`)
                continue
            }
            this.roles.push(role)
            Logger.success(`ban: Added role [${role.name}] to list`)
            
            this.registerCommands()
        }
    }
    
    private async registerCommands() {

        await this.bot.guild?.commands.create({
            name: "exile",
            description: "Manage user exiles",
            options: [
                {
                    name: "add",
                    description: "Exiles the user",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: "user",
                            description: "The user to exile",
                            type: ApplicationCommandOptionType.User,
                            required: true
                        },
                        {
                            name: "reason",
                            description: "Reason for the exile",
                            type: ApplicationCommandOptionType.String,
                            required: true
                        }
                    ]
                },
                {
                    name: "remove",
                    description: "Readmits the user",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: "user",
                            description: "The user to remove the exile from",
                            type: ApplicationCommandOptionType.User,
                            required: true
                        }
                    ]
                }
            ]
        })
        
        Logger.info(`exile: Registered commands`)
    }

    private async onSlashCommand(interaction: ChatInputCommandInteraction) {
        if (interaction.commandName !== "exile") {
            return
        }

        const member = await this.bot.guild?.members.fetch(interaction.user.id)
        if (!member  || await this.bot.isModerator(member)) {
            await interaction.reply({ content: Locale.noPermission, flags: MessageFlags.Ephemeral })
            return
        }

        const subCommand = interaction.options.getSubcommand()
        const target = interaction.options.getUser("user", true)

        switch (subCommand) {
            case "add":
                await this.exileUser(target, interaction.options.getString("reason"), interaction)
                break
            case "remove":
                await this.readmitUser(target, interaction)
                break
            default:
                Logger.warn(`exile: interaction wasn't: ${this.commandNames}`)
        }
    }
    
    private async exileUser(user: User, reason: String | null, interaction: ChatInputCommandInteraction) {
        const member = await this.bot.guild?.members.fetch(user.id)
        if (!member) {
            await interaction.reply({
                content: Locale.memberIsNull,
                flags: MessageFlags.Ephemeral
            })
            return
        }

        if (this.config.moderation.exile.stripRoles) {
            member.roles.remove(member.roles.cache)
        }
        
        const { error } = await tryCatch(sql`
            INSERT INTO exiles (user_id, reason, active, given_at)
            VALUES (${member.id}, ${reason}, 1, NOW())
        `)

        if (error) {
            interaction.reply({
                content: "Failed to update the database",
                flags: MessageFlags.Ephemeral
            })
            return
        }

        member.roles.add(this.roles)
        await interaction.reply({
            content: "User has been exiled",
            flags: MessageFlags.Ephemeral
        })
    }

    private async readmitUser(user: User, interaction: ChatInputCommandInteraction) {
        const member = await this.bot.guild?.members.fetch(user.id)

        if (!member) {
            await interaction.reply({
                content: "Failed to fetch member",
                flags: MessageFlags.Ephemeral
            })
            return
        }

        const { error } = await tryCatch(sql`
            UPDATE exiles
            SET active = 0
            WHERE user_id = ${member.id} AND active = 1
        `)

        if (error) {
            await interaction.reply({
                content: "Unable to update database",
                flags: MessageFlags.Ephemeral
            })
            return
        }
        
        member.roles.remove(this.roles)
        await interaction.reply({
            content: "User has be readmitted",
            flags: MessageFlags.Ephemeral
        })
    }
    
    public async contextInteraction(interaction: ContextMenuCommandInteraction): Promise<void> {
        if (interaction.isChatInputCommand()) {
            this.onSlashCommand(interaction)
        }
    }

    public async memberJoined(member: GuildMember): Promise<void> {}

    public async memberLeft(member: GuildMember | PartialGuildMember): Promise<void> {}
}