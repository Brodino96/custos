import { defineConfig } from "rolldown"

export default defineConfig([
	{
		input: "src/main.ts",
		output: {
			file: "dist/main.js",
			target: "esnext",
		},
		external: [ /node_modules/ ]
	},
])
