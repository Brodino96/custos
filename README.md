# discord_moderator_bot

# Config
```ts
export type ConfigType = DeepReadonly<{

	checkInterval: number // Hour intervals between checks

	bot: {
		token: string // The bot token
		guildId: Snowflake // Your Discord server id
		clientId: Snowflake // Your bot client id
	}

	moderation: {
		moderatorRoles: Array<Snowflake> // Roles considered as moderator (will be checked on every command use)
		warn: {
			enabled: boolean // If the warn system should be enabled
			roles: Array<Snowflake> // The roles to be given as warn (will also be the max number of warn)
			canExpire: boolean // If the warns should be removed after some time
			expiresAfter: number // Days until the warn gets removed
			ban: {
				enabled: boolean // If the bot should ban the user when given a warn that exceed the limit
				banMessage: string // The reason for the ban
			}
		}
	}

	switchingRoles: {
		enabled: true // When giving a role a count down will start, when it's done it will remove the role and give the specified ones
		roles: Record<Snowflake, Array<Snowflake>> // The lone id it's the role it will listen for, the array is the roles that it will give when the time expires
		duration: number // Days until the role swap
	}

	joinRoles: {
		enabled: boolean // if it should give roles when joining the server
		roles: Array<Snowflake> // The roles to give
		expires: boolean // If the roles should expire after some time
		duration: number // Days until the roles expires
	}
}>
```