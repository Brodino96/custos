import type { GuildMember, PartialGuildMember } from "discord.js"
import Bot from "./modules/bot"
import TempRole from "./modules/tempRole"

class Main {
    private readonly bot = new Bot()
    private readonly tempRole = new TempRole(this.bot)

    public async init() {
        this.bot.client.on("guildMemberAdd", (member: GuildMember) => {
            this.tempRole.memberJoined(member)
        })

        this.bot.client.on("guildMemberRemove", (member: GuildMember | PartialGuildMember) => {
            this.tempRole.memberLeft(member.id)
        })
    }
}

new Main().init()