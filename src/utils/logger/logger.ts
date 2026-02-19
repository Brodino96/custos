import { cyan, gray, red, yellow } from "./colors.ts"

type ColorFunction = (text: string) => string

export class Logger {
	private readonly moduleName: string
	private static logLevel: number = 3 // Default: all logs enabled

	constructor(moduleName: string) {
		this.moduleName = moduleName
	}

	/**
	 * Set the global log level for all Logger instances.
	 * @param level - Log level (0=disabled, 1=error, 2=error+warn, 3=all)
	 */
	static setLogLevel(level: number): void {
		Logger.logLevel = level
	}

	public info(...args: unknown[]): void {
		if (Logger.logLevel >= 3) {
			this.log("INFO", cyan, ...args)
		}
	}

	public warn(...args: unknown[]): void {
		if (Logger.logLevel >= 2) {
			this.log("WARN", yellow, ...args)
		}
	}

	public error(...args: unknown[]): void {
		if (Logger.logLevel >= 1) {
			this.log("ERROR", red, ...args)
		}
	}

	private log(level: string, colorFn: ColorFunction, ...args: unknown[]): void {
		const timestamp = this.getFormattedNow()
		const formattedArgs = this.formatArgs(args)

		console.log(
			`${gray(timestamp)} ${colorFn(`[${level}]`)} ${this.moduleName}: ${formattedArgs}`
		)
	}

	private getFormattedNow(): string {
		const now = new Date()
		const day = String(now.getDate()).padStart(2, "0")
		const month = String(now.getMonth() + 1).padStart(2, "0")
		const year = now.getFullYear()
		const hours = String(now.getHours()).padStart(2, "0")
		const minutes = String(now.getMinutes()).padStart(2, "0")
		const seconds = String(now.getSeconds()).padStart(2, "0")

		return `[${day}-${month}-${year} ${hours}:${minutes}:${seconds}]`
	}

	private formatArgs(args: unknown[]): string {
		return args.map((arg) => this.formatArg(arg)).join(" ")
	}

	/**
	 * Format a single argument based on its type
	 * - Error objects: Include stack trace (first 5 lines)
	 * - Objects: JSON stringify
	 * - Primitives: String conversion
	 */
	private formatArg(arg: unknown): string {
		if (arg instanceof Error) {
			if (arg.stack) {
				const stackLines = arg.stack.split("\n").slice(0, 5)
				return stackLines.join("\n    ")
			}
			return `${arg.name}: ${arg.message}`
		}

		if (arg !== null && typeof arg === "object") {
			try {
				return JSON.stringify(arg)
			} catch {
				return String(arg)
			}
		}

		return String(arg)
	}
}
