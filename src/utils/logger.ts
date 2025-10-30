export default class Logger {
    private module: string
    
    constructor(module: string) {
        this.module = module
    }

    public info(txt: string) {
        console.log(`[INFO] ${this.module}: ${txt}`)
    }
    
    public error(txt: string) {
        console.log(`\x1b[31m[ERROR] ${this.module}: ${txt}`)
    }

    public success(txt: string) {
        console.log(`\x1b[32m[SUCCESS] ${this.module}: ${txt}`)
    }

    public warn(txt: string) {
        console.log(`\x1b[33m[WARNING] ${this.module}: ${txt}`)
    }
}