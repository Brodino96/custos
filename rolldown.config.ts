import { defineConfig } from "rolldown"

export default defineConfig([
    {
        input: "src/main.ts",
        output: {
            file: "dist/main.ts",
            target: "esnext", // FiveM should use es2017
            minify: true
        }
    },
])