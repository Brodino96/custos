import { parse, stringify } from "yaml"
import { Logger } from "../logger/logger.ts"
import { configSchema } from "./schema.ts"
import type { Config } from "./types.ts"

const DEFAULT_CONFIG_PATH = "default.config.yaml"
const USER_CONFIG_PATH = "config/config.yaml"

const logger = new Logger("config")

interface MissingField {
	path: string
	value: unknown
}

function mergeConfig(
	target: Record<string, unknown>,
	source: Record<string, unknown>,
	currentPath = "",
): MissingField[] {
	const missing: MissingField[] = []

	for (const key in target) {
		const targetValue = target[key]
		const sourceValue = source[key]
		const fieldPath = currentPath ? `${currentPath}.${key}` : key

		// If key is missing in source, add it
		if (!(key in source)) {
			source[key] = targetValue
			missing.push({ path: fieldPath, value: targetValue })
			continue
		}

		// If both are objects (not arrays), recurse
		if (
			targetValue !== null &&
			typeof targetValue === "object" &&
			!Array.isArray(targetValue) &&
			sourceValue !== null &&
			typeof sourceValue === "object" &&
			!Array.isArray(sourceValue)
		) {
			const nestedMissing = mergeConfig(
				targetValue as Record<string, unknown>,
				sourceValue as Record<string, unknown>,
				fieldPath,
			)
			missing.push(...nestedMissing)
		}
	}

	return missing
}

/**
 * Loads and validates the Custos configuration.
 * @returns Promise<Config> - Validated configuration object
 * @throws Error if validation fails or files cannot be read
 */
export async function loadConfig(): Promise<Config> {
	let defaultText: string
	let defaultConfig: Record<string, unknown>

	try {
		const defaultFile = Bun.file(DEFAULT_CONFIG_PATH)
		defaultText = await defaultFile.text()
		defaultConfig = parse(defaultText) as Record<string, unknown>
	} catch (error) {
		throw new Error(
			`Failed to read or parse default config at ${DEFAULT_CONFIG_PATH}: ${error}`,
		)
	}

	const userFile = Bun.file(USER_CONFIG_PATH)
	const userExists = await userFile.exists()

	if (!userExists) {
		logger.warn(`No config found at ${USER_CONFIG_PATH}`)
		logger.info(`Creating from ${DEFAULT_CONFIG_PATH}...`)

		try {
			await Bun.write(USER_CONFIG_PATH, defaultText)
		} catch (error) {
			throw new Error(
				`Failed to create config at ${USER_CONFIG_PATH}: ${error}`,
			)
		}

		logger.info(`Config created at ${USER_CONFIG_PATH}`)
		logger.info(`Please update it with your Discord bot token and settings.`)

		const validation = configSchema.safeParse(defaultConfig)
		if (!validation.success) {
			throw new Error(
				`Default config validation failed: ${validation.error.message}`,
			)
		}

		return validation.data as Config
	}

	let userText: string
	let userConfig: Record<string, unknown>

	try {
		userText = await userFile.text()
		userConfig = parse(userText) as Record<string, unknown>
	} catch (error) {
		throw new Error(
			`Failed to read or parse user config at ${USER_CONFIG_PATH}: ${error}`,
		)
	}

	const missingFields = mergeConfig(defaultConfig, userConfig)

	if (missingFields.length > 0) {
		logger.warn(`Config updated with missing fields:`)
		for (const field of missingFields) {
			logger.info(`  + ${field.path}`)
		}

		const mergedYaml = stringify(userConfig, {
			indent: 2,
			lineWidth: 80,
		})

		try {
			await Bun.write(USER_CONFIG_PATH, mergedYaml)
			logger.info(`Config saved to ${USER_CONFIG_PATH}`)
		} catch (error) {
			logger.error(`Failed to write updated config: ${error}`)
		}
	} else {
		logger.info(`Config loaded from ${USER_CONFIG_PATH}`)
		logger.info(`(No changes needed)`)
	}

	const validation = configSchema.safeParse(userConfig)

	if (!validation.success) {
		logger.error(`Config validation failed:`)

		for (const issue of validation.error.issues) {
			const path = issue.path.join(".")
			logger.error(`  - ${path}: ${issue.message}`)
		}

		throw new Error(
			`Config validation failed. Please check ${USER_CONFIG_PATH}`,
		)
	}

	return validation.data as Config
}
