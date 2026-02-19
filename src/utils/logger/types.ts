export type LogLevel = 0 | 1 | 2 | 3

export const LOG_LEVEL = {
	DISABLED: 0,
	ERROR: 1,
	WARN: 2,
	INFO: 3,
} as const
