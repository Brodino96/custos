import type { GuildMember, PartialGuildMember, ContextMenuCommandInteraction } from "discord.js"
import { BotModule } from "./botmodule"

export default class TempRoles extends BotModule {

    public async init(): Promise<void> {
        throw new Error("Method not implemented.");
    }

    public async memberJoined(member: GuildMember): Promise<void> {
        throw new Error("Method not implemented.");
    }

    public async memberLeft(member: GuildMember | PartialGuildMember): Promise<void> {
        throw new Error("Method not implemented.");
    }

    public async contextInteraction(interaction: ContextMenuCommandInteraction, source: GuildMember): Promise<void> {
        throw new Error("Method not implemented.");
    }

}
