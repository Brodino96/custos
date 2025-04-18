export default class Logger {
    static error(txt: string) {
        console.log("\x1b[31m", `[ERROR] ${txt}`)
    }
    static success(txt: string) {
        console.log("\x1b[32m", `[SUCCESS] ${txt}`)
    }
    static info(txt: string) {
        console.log(`[INFO] ${txt}`)
    }
    static warn(txt: string) {
        console.log("\x1b[33m", `[WARNING] ${txt}`)
    }
}