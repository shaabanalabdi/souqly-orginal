// FILE: backend/src/shared/utils/logger.ts

import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const fmt = printf(({ level, message, timestamp: ts, stack }) =>
    `${ts} [${level}]: ${stack || message}`
);

export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), errors({ stack: true }), fmt),
    transports: [
        new winston.transports.Console({ format: combine(colorize(), fmt) }),
    ],
});

if (process.env.NODE_ENV === 'production') {
    logger.add(new winston.transports.File({ filename: 'logs/error.log', level: 'error', maxsize: 5_242_880, maxFiles: 5 }));
    logger.add(new winston.transports.File({ filename: 'logs/combined.log', maxsize: 5_242_880, maxFiles: 5 }));
}
