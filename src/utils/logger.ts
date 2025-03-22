export default class Logger {
    public error(txt: string) {
        console.log("\x1b[31m", `[ERROR] ${txt}`)
    }
    public success(txt: string) {
        console.log("\x1b[32m", `[SUCCESS] ${txt}`)
    }
    public info(txt: string) {
        console.log(`[INFO] ${txt}`)
    }
    public warn(txt: string) {
        console.log("\x1b[33m", `[WARNING] ${txt}`)
    }
}