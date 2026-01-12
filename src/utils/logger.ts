import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';

export class Logger {
  private logger: winston.Logger;
  private static instances: Map<string, Logger> = new Map();

  constructor(moduleName: string = 'app') {
    if (Logger.instances.has(moduleName)) {
      this.logger = Logger.instances.get(moduleName)!.logger;
      return Logger.instances.get(moduleName)!;
    }

    // Ensure logs directory exists
    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/:/g, '_').replace(/\..+/, '');
    const logFile = path.join(logDir, `${timestamp}.log`);

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { module: moduleName },
      transports: [
        new winston.transports.File({ 
          filename: logFile,
          format: winston.format.json()
        }),
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });

    Logger.instances.set(moduleName, this);
  }

  info(message: string, meta?: any) {
    this.logger.info(message, meta);
  }

  error(message: string, meta?: any) {
    this.logger.error(message, meta);
  }

  warn(message: string, meta?: any) {
    this.logger.warn(message, meta);
  }

  debug(message: string, meta?: any) {
    this.logger.debug(message, meta);
  }

  // Static method for global logger access
  static getLogger(moduleName: string = 'app'): Logger {
    if (!Logger.instances.has(moduleName)) {
      new Logger(moduleName);
    }
    return Logger.instances.get(moduleName)!;
  }
}

// Global logger instance (compatible with Python code pattern)
export const GLOBAL_LOGGER = Logger.getLogger();