import { type GuildMember, type PartialGuildMember, type ContextMenuCommandInteraction, type Message, type Role, type Snowflake, SlashCommandBuilder, ChatInputCommandInteraction, type Interaction, MessageFlags, AuditLogEvent } from "discord.js"
import { BotModule } from "./bot"
import { tryCatch } from "typecatch"
import { sql } from "bun"
import Logger from "../utils/logger"

export default class switchingRoles extends BotModule {

    private readonly roles: Map<Snowflake, Array<Role>> = new Map()

    async init(): Promise<void> {

        for (const [ key, value ] of Object.entries(this.config.switchingRoles.roles)) {

            const afterRoles = []
            for (const afterRoleId of value) {
                const afterRole = await this.bot.guild?.roles.fetch(afterRoleId)
                if (!afterRole) {
                    Logger.warn(`switchingRoles: Failed to fetch role with id: ${afterRoleId}`)
                    continue
                }
                afterRoles.push(afterRole)
            }

            this.roles.set(key, afterRoles)

            Logger.success(`switchingRoles: Added roles [${key}, ${afterRoles.map(role => role.name)}] to list`)
        }

        this.bot.client.on("guildMemberUpdate", async (oldMember, newMember) => {
            this.guildMemberUpdate(oldMember, newMember)
        })

        this.checkRoles()
        setInterval(() => {
            this.checkRoles()
        }, Math.floor(this.config.checkInterval * 1000 * 60 * 60))
    }

    private async registerCommands() {
        const command = new SlashCommandBuilder()
            .setName("updaterole")
            .setDescription("Checks for how long you had ElysiumNewPlayer and updates it to ElysiumCraft")

        await this.bot.guild?.commands.create(command)
        Logger.info("switchingRoles: Registered commands")
    }

    private async guildMemberUpdate(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember): Promise<void> {

        if (oldMember.roles.cache.size === newMember.roles.cache.size) {
            return
        }
        
        const addedRoles = newMember.roles.cache
            .filter(role => !oldMember.roles.cache.has(role.id))
            .map((role: Role) => role.id)

        for (const role of addedRoles) {
            if (this.roles.has(role)) {
                Logger.info(`switchingRoles: [${newMember.displayName}] recived a switchingRole`)
                const { error } = await tryCatch(sql`
                    INSERT INTO switching_roles (user_id, given_at, role_id)
                    VALUES (${newMember.id}, NOW(), ${role})
                `)
                    
                if (error) {
                    Logger.error(`switchingRoles: Failed to insert user [${newMember.displayName}] into the database, ${error}`)
                    continue
                }

                Logger.success(`switchingRoles: Added user [${newMember.displayName}]`)
            }
        }
    }

    /**
     * Periodically checks if switchingRoles are expired
     * @returns void
     */
    private async checkRoles() {

        Logger.info("switchingRoles: Checking...")
        
        const { data: deletedUsers, error } = await tryCatch(sql`
            DELETE FROM switching_roles
            WHERE given_at < NOW() - (${this.config.switchingRoles.duration} * INTERVAL '1 days')
            RETURNING user_id, role_id
        `)

        if (error) {
            Logger.error(`switchingRoles: Failed to delete users from database, ${error}`)
            return
        }

        if (!deletedUsers[0]) {
            return Logger.info("switchingRoles: No user has been deleted from the database")
        }

        Logger.info(`switchingRoles: Deleted users from database: \n${deletedUsers}`)
        
        for (const user of deletedUsers) {
            const { data: member, error } = await tryCatch(this.bot.guild!.members.fetch(user.user_id))
            
            if (error) { continue }

            if (!member) {
                Logger.error(`switchingRoles: Failed to fetch member [${user.user_id}], he probably left the server while the bot wasn't active`)
                continue
            }


            const roleToRemove = await this.bot.guild?.roles.fetch(user.role_id)
            if (!roleToRemove) {
                Logger.warn(`switchingRoles: Failed to fetch role with id: ${user.role_id}`)
                continue
            }
            
            await member.roles.remove(roleToRemove)
            await member.roles.add(this.roles.get(user.role_id)!)
            Logger.success(`switchingRoles: Removed roles for user [${member.displayName}]`)
        }
    }

    public async contextInteraction(interaction: Interaction): Promise<void> {
        if (!interaction.isChatInputCommand()) { return }

        if (interaction.commandName === "updaterole") {
            await this.handleCommand(interaction)
        }
    }

    private async handleCommand(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            flags: MessageFlags.Ephemeral
        })

        try {
            const member = interaction.member as GuildMember
            const guild = interaction.guild
            
            if (!guild) {
                await interaction.editReply("This command can only be used in a server.")
                return
            }

            if (!member.roles.cache.has(this.config.switchingRoles.temp.first)) {
                await interaction.editReply("You do not have the target role.")
                return
            }

            const auditLogs = await guild.fetchAuditLogs({
                type: AuditLogEvent.MemberRoleUpdate,
                limit: 100
            })

            let roleAddedDate: Date | null = null
            
            for (const [, log] of auditLogs.entries) {
                if (log.target?.id === member.id && 
                    log.changes?.some(change => 
                        change.key === "$add" && 
                        Array.isArray(change.new) &&
                        change.new.some((role: any) => role.id === this.config.switchingRoles.temp.first)
                    )) {
                    roleAddedDate = log.createdAt
                    break
                }
            }

            let daysSinceAdded: number = 200

            if (roleAddedDate) {
                daysSinceAdded = Math.floor((Date.now() - roleAddedDate.getTime()) / (1000 * 60 * 60 * 24))
            }

            if (daysSinceAdded >= this.config.switchingRoles.duration) {
                try {
                    await member.roles.remove(this.config.switchingRoles.temp.first)
                    await member.roles.add(this.config.switchingRoles.temp.second)
                    
                    await interaction.editReply(
                        `Role updated! You had the target role for ${daysSinceAdded} days (threshold: ${this.config.switchingRoles.duration} days). ` +
                        "Target role removed and replacement role added."
                    )
                } catch (error) {
                    console.error("Error updating roles:", error)
                    await interaction.editReply("Error: Could not update roles. Check bot permissions.")
                }
            } else {
                const daysRemaining: number = this.config.switchingRoles.duration - daysSinceAdded
                await interaction.editReply(
                    `You have had the target role for ${daysSinceAdded} days. ` +
                    `You need to wait ${daysRemaining} more days before it can be updated.`
                )
            }

        } catch (error) {
            console.error("Error in updaterole command:", error)
            await interaction.editReply("An error occurred while processing the command.")
        }
    }

    async memberJoined(member: GuildMember): Promise<void> {}
    async memberLeft(member: GuildMember | PartialGuildMember): Promise<void> {}
    async messageCreate(message: Message): Promise<void> {}
    
}