import type { GuildMember, PartialGuildMember, ContextMenuCommandInteraction } from "discord.js";
import { BotModule } from "./botmodule"
import Logger from "../utils/logger";

export default class JoinRoles extends BotModule {

    private readonly logger = new Logger("JoinRoles")

    /**
     * Initializes the module
     */
    public async init(): Promise<void> {
        this.logger.info("Initializing")
    }
    
    public async memberJoined(member: GuildMember): Promise<void> {}
    public async memberLeft(member: GuildMember | PartialGuildMember): Promise<void> {}
    public async contextInteraction(interaction: ContextMenuCommandInteraction, source: GuildMember): Promise<void> {}

}