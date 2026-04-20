const chalk = require('chalk');

class Logger {
    static getTimestamp() {
        return new Date().toLocaleTimeString();
    }
    
    static info(message, ...args) {
        console.log(
            chalk.blue(`[${this.getTimestamp()}] [INFO]`),
            message,
            ...args
        );
    }
    
    static success(message, ...args) {
        console.log(
            chalk.green(`[${this.getTimestamp()}] [SUCCESS]`),
            message,
            ...args
        );
    }
    
    static warn(message, ...args) {
        console.log(
            chalk.yellow(`[${this.getTimestamp()}] [WARN]`),
            message,
            ...args
        );
    }
    
    static error(message, ...args) {
        console.log(
            chalk.red(`[${this.getTimestamp()}] [ERROR]`),
            message,
            ...args
        );
    }
    
    static debug(message, ...args) {
        if (process.env.DEBUG === 'true') {
            console.log(
                chalk.gray(`[${this.getTimestamp()}] [DEBUG]`),
                message,
                ...args
            );
        }
    }
}

module.exports = { logger: Logger };
