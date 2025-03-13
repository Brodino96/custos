import { ApplicationCommandType, ContextMenuCommandBuilder, REST, Routes, SlashCommandBuilder } from "discord.js"
import type { Client, Interaction } from "discord.js"
import Config from "../utils/config"

export default class CommandHandler {
	private client: Client
	private commands = new Map<string, (interaction: Interaction) => void>()

	constructor(client: Client) {
		this.client = client
		this.registerCommands()
		this.listen()
	}

	private async registerCommands() {
		const rest = new REST({ version: "10" }).setToken(Config.token)

		const commands = [new SlashCommandBuilder().setName("ping").setDescription("Risponde con Pong!"), new ContextMenuCommandBuilder().setName("Info Utente").setType(ApplicationCommandType.User)]

		await rest.put(Routes.applicationGuildCommands(Config.clientId, Config.guildId), { body: commands.map((cmd) => cmd.toJSON()) })

		console.log("Comandi registrati con successo.")

		// Associazione delle funzioni ai comandi
		this.commands.set("ping", async (interaction) => {
			if (interaction.isCommand()) {
				await interaction.reply("🏓 Pong!")
			}
		})

		this.commands.set("Info Utente", async (interaction: Interaction) => {
			if (!interaction.isContextMenuCommand()) {
				return
			}

			await interaction.reply(`👤 Informazioni su: ${interaction.targetId}`)
		})
	}

	private listen() {
		this.client.on("interactionCreate", async (interaction) => {
			if (!interaction.isCommand() && !interaction.isContextMenuCommand()) return

			const commandHandler = this.commands.get(interaction.commandName)
			if (commandHandler) {
				try {
					await commandHandler(interaction)
				} catch (error) {
					console.error(error)
					await interaction.reply({ content: "Errore nell'esecuzione del comando.", ephemeral: true })
				}
			}
		})
	}
}
