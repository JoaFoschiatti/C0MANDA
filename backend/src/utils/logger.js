/**
 * Structured logging with Winston
 *
 * Provides consistent, structured logging across the application.
 * Logs are written to console in development and to files in production.
 *
 * Log levels: error, warn, info, http, debug
 *
 * @module logger
 */

const winston = require('winston');
const path = require('path');
const { ensureDirectory, getRuntimePaths } = require('../config/runtime');

// Determine log level based on environment
const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Custom format for console (colorized and pretty-printed)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;

    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta, null, 2)}`;
    }

    return msg;
  })
);

// JSON format for file logging (production)
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Define transports
const transports = [];

// Console transport is always present to avoid Winston warnings in tests.
transports.push(
  new winston.transports.Console({
    format: consoleFormat,
    silent: process.env.NODE_ENV === 'test'
  })
);

// File transports (production only)
if (process.env.NODE_ENV === 'production') {
  const { logsDir: logDir } = getRuntimePaths();
  ensureDirectory(logDir);

  // Combined log file
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      format: fileFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5
    })
  );

  // Error log file
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: logLevel,
  transports,
  // Don't exit on error
  exitOnError: false
});

// Winston logger already has these methods built-in, no need to override
// Just add JSDoc for documentation

/**
 * Log an informational message
 * @param {string} message - Message to log
 * @param {Object} [meta] - Additional metadata
 *
 * @example
* logger.info('User logged in', { userId: 123, negocio: 'principal' });
 */

/**
 * Log a warning message
 * @param {string} message - Message to log
 * @param {Object} [meta] - Additional metadata
 *
 * @example
 * logger.warn('Stock running low', { productId: 45, stock: 2 });
 */

/**
 * Log an error message
 * @param {string} message - Message to log
 * @param {Error|Object} [meta] - Error object or metadata
 *
 * @example
 * logger.error('Database connection failed', error);
 * logger.error('Payment processing failed', { paymentId: 123, reason: 'timeout' });
 */

/**
 * Log HTTP request (useful for request logging middleware)
 * @param {string} message - Message to log
 * @param {Object} [meta] - Request metadata
 *
 * @example
 * logger.http('Incoming request', { method: 'POST', url: '/api/pedidos', userId: 123 });
 */

/**
 * Log debug information (only in development)
 * @param {string} message - Message to log
 * @param {Object} [meta] - Debug metadata
 *
 * @example
 * logger.debug('Query executed', { sql: 'SELECT ...', duration: 45 });
 */

module.exports = { logger };

