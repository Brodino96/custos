import { type GuildMember, type PartialGuildMember, type ContextMenuCommandInteraction, SlashCommandBuilder, ApplicationCommandType, ApplicationCommandOptionType, CommandInteraction, ChatInputCommandInteraction } from "discord.js"
import { BotModule } from "./botmodule"
import Logger from "../utils/logger"
import { tryCatch } from "typecatch"
import { sql } from "bun"
import Locale from "../utils/locale"

export default class Probation extends BotModule {

    private readonly config = this.baseConfig.probation
    private readonly logger = new Logger("Probation")

    public async init(): Promise<void> {
        this.logger.info("Initializing module")
    }

    public async memberJoined(member: GuildMember): Promise<void> {}
    public async memberLeft(member: GuildMember | PartialGuildMember): Promise<void> {}

    public async contextInteraction(interaction: CommandInteraction, source: GuildMember): Promise<void> {
        if (!interaction.isChatInputCommand() || interaction.commandName != "probation") return
        this.onCommand(interaction)
    }

    private async onCommand(interaction: ChatInputCommandInteraction) {
        const target = await this.bot.guild.members.fetch(interaction.options.getUser("User", true))

        if (!target) {
            interaction.editReply(Locale.generic.noTarget)
            return this.logger.error(Locale.generic.noTarget)
        }

        if (await this.bot.isModerator(target)) {
            interaction.editReply(`⛔ <@${target.user.id}> is a moderator`)
            return this.logger.info(`Stopping because ${target.user.username} is a moderator`)
        }

        const { data, error } = await tryCatch(sql`
            SELECT COUNT(*) AS count FROM probation WHERE user_id = ${target.user.id} AND active = TRUE
        `)

        if (error) {
            interaction.editReply(Locale.generic.dbFailure)
            return this.logger.error(`${Locale.generic.dbFailure}, ${error}`)
        }

        if (data[0].count >= 0) {
            interaction.editReply(`⛔ <@${target.user.id}> is already on probation`)
            return this.logger.info(`${target.user.username} is already on probation`)
        }
    }

    private async registerCommands() {
        await this.bot.guild.commands.create({
            name: "probation",
            description: "Assings a temporary role that get replaced with other roles",
            options: [
                {
                    name: "User",
                    description: "The user to put on probation",
                    type: ApplicationCommandOptionType.User,
                    required: true
                }
            ]
        })

        this.logger.success("Registerd commands")
    }
}
