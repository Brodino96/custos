import { type GuildMember, type PartialGuildMember, type ContextMenuCommandInteraction, SlashCommandBuilder, ApplicationCommandType, ApplicationCommandOptionType, CommandInteraction, ChatInputCommandInteraction } from "discord.js"
import { BotModule } from "./botmodule"
import Logger from "../utils/logger";

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
