import { MessageFlags, ApplicationCommandOptionType, ChatInputCommandInteraction, User, ApplicationCommandType } from "discord.js"
import type { GuildMember, PartialGuildMember, ContextMenuCommandInteraction, Role } from "discord.js"
import { BotModule } from "./bot"
import Logger from "../utils/logger"
import Locale from "../utils/locale"
import { sql } from "bun"
import { tryCatch } from "typecatch"

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
        Promise.all([
            this.bot.guild?.commands.create({
                name: "Exile add",
                type: ApplicationCommandType.User
            }),
            this.bot.guild?.commands.create({
                name: "Exile remove",
                type: ApplicationCommandType.User
            }),
            this.bot.guild?.commands.create({
                name: "Exile info",
                type: ApplicationCommandType.User
            })
        ])

        Logger.info(`exile: Registered commands`)
    }

    public async contextInteraction(interaction: ContextMenuCommandInteraction): Promise<void> {
        if (!interaction.isContextMenuCommand()) { return }

        switch (interaction.commandName) {
            case "Exile add": break
            case "Exile remove": break
            case "Exile info": break
            default: return
        }

        const member = await this.bot.guild?.members.fetch(interaction.user.id)
        if (!member) {
            Logger.error("exile: Command user is null")
            await interaction.reply({
                content: "Somehow you are not a user????",
                flags: MessageFlags.Ephemeral
            })
            return
        }

        if (!this.bot.isModerator(member)) {
            await interaction.reply({
                content: Locale.noPermission,
                flags: MessageFlags.Ephemeral
            })
            return
        }

        const targetMember = await this.bot.guild?.members.fetch(interaction.targetId)
        if (!targetMember) {
            Logger.error("exile: Target member is null")
            await interaction.reply({
                content: "Target member does not exists",
                flags: MessageFlags.Ephemeral
            })
            return
        }

        Logger.info(`exile: ${member.user.username} is trying to ${interaction.commandName} the user ${targetMember.user.username}`)

        switch (interaction.commandName) {
            case "Exile add":
                await this.exileUser(targetMember.user, interaction)
                break
            case "Exile remove":
                await this.readmitUser(targetMember.user, interaction)
                break
            case "Exile info":
                await this.getInfo(targetMember.user, interaction)
                break
        }
    }

    private async getInfo(user: User, interaction: ContextMenuCommandInteraction) {
        const { data, error } = await tryCatch(sql`
            SELECT given_at FROM exiles WHERE user_id = ${user.id} AND active = 1
        `)

        if (error) {
            await interaction.reply({
                content: "Failed to fetch info from the database",
                flags: MessageFlags.Ephemeral
            })
        }

        await interaction.reply({
            content: data,
            flags: MessageFlags.Ephemeral
        })
    }
    
    private async exileUser(user: User, interaction: ContextMenuCommandInteraction) {
        const member = await this.bot.guild?.members.fetch(user.id)
        if (!member) {
            await interaction.reply({
                content: Locale.memberIsNull,
                flags: MessageFlags.Ephemeral
            })
            return
        }
        
        const { error } = await tryCatch(sql`
            INSERT INTO exiles (user_id, reason, active, given_at)
            VALUES (${member.id}, ${""}, 1, NOW())
        `)

        if (error) {
            interaction.reply({
                content: "Failed to update the database",
                flags: MessageFlags.Ephemeral
            })
            return
        }

        if (this.config.moderation.exile.stripRoles) {
            await member.roles.remove(member.roles.cache)
        }

        await member.roles.add(this.roles)
        await interaction.reply({
            content: "User has been exiled",
            flags: MessageFlags.Ephemeral
        })
    }

    private async readmitUser(user: User, interaction: ContextMenuCommandInteraction) {
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
    


    public async memberJoined(member: GuildMember): Promise<void> {}

    public async memberLeft(member: GuildMember | PartialGuildMember): Promise<void> {}
}