import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define log levels with colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'blue',
  debug: 'green',
  trace: 'gray',
};

winston.addColors(colors);

/**
 * Create a logger instance for a specific module
 * @param label - Module label/name
 * @returns Winston logger instance
 */
export function createLogger(label: string = 'APP') {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.label({ label }),
      winston.format.colorize(),
      winston.format.printf(({ level, message, timestamp, label, stack }) => {
        const stackStr = stack ? `\n${stack}` : '';
        return `[${timestamp}] [${label}] ${level}: ${message}${stackStr}`;
      })
    ),
    transports: [
      // Console transport
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ level, message, timestamp, label }) => {
            return `[${timestamp}] [${label}] ${level}: ${message}`;
          })
        ),
      }),

      // File transport - all logs
      new winston.transports.File({
        filename: path.join('logs', 'combined.log'),
        maxsize: 10485760, // 10MB
        maxFiles: 5,
      }),

      // File transport - errors only
      new winston.transports.File({
        filename: path.join('logs', 'error.log'),
        level: 'error',
        maxsize: 10485760, // 10MB
        maxFiles: 5,
      }),
    ],
  });
}

export default createLogger;
