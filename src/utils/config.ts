import type { Snowflake } from "discord.js"
import conf from "../../config.toml"

type ConfigType = {
    token: string,
    guildId: Snowflake,
    clientId: Snowflake,
    tempRole: {
        rolesId: Array<Snowflake>,
        roleDuration: number,
        checkInterval: number
    }
}

const Config: ConfigType = conf
export default Config