/**
 * Structured JSON Logger
 * Provides consistent logging with appropriate levels per constitution IV.
 */

import type { LogLevel, LogEntry } from '../types/index.js';

/**
 * Logger class for structured JSON logging.
 * Outputs machine-parseable JSON logs with timestamps and context.
 */
export class Logger {
  private readonly context: string;
  private verbose: boolean;

  /**
   * Creates a new Logger instance.
   * @param context - The context/module name for log entries
   * @param verbose - Enable verbose (debug) logging
   */
  constructor(context: string, verbose = false) {
    this.context = context;
    this.verbose = verbose;
  }

  /**
   * Sets verbose mode for debug logging.
   * @param enabled - Whether to enable verbose logging
   */
  setVerbose(enabled: boolean): void {
    this.verbose = enabled;
  }

  /**
   * Creates a structured log entry.
   * @param level - Log level
   * @param message - Log message
   * @param additionalContext - Additional context data
   */
  private createEntry(
    level: LogLevel,
    message: string,
    additionalContext?: Record<string, unknown>
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: {
        module: this.context,
        ...additionalContext,
      },
    };
  }

  /**
   * Outputs a log entry to console.
   * @param entry - The log entry to output
   */
  private output(entry: LogEntry): void {
    const json = JSON.stringify(entry);

    switch (entry.level) {
      case 'error':
        console.error(json);
        break;
      case 'warn':
        console.warn(json);
        break;
      case 'debug':
        if (this.verbose) {
          console.debug(json);
        }
        break;
      default:
        console.log(json);
    }
  }

  /**
   * Logs a debug message (only shown in verbose mode).
   * @param message - Debug message
   * @param context - Additional context
   */
  debug(message: string, context?: Record<string, unknown>): void {
    if (this.verbose) {
      this.output(this.createEntry('debug', message, context));
    }
  }

  /**
   * Logs an info message.
   * @param message - Info message
   * @param context - Additional context
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.output(this.createEntry('info', message, context));
  }

  /**
   * Logs a warning message.
   * @param message - Warning message
   * @param context - Additional context
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.output(this.createEntry('warn', message, context));
  }

  /**
   * Logs an error message.
   * @param message - Error message
   * @param context - Additional context
   */
  error(message: string, context?: Record<string, unknown>): void {
    this.output(this.createEntry('error', message, context));
  }

  /**
   * Logs an error with stack trace.
   * @param message - Error message
   * @param err - Error object
   * @param context - Additional context
   */
  errorWithStack(message: string, err: Error, context?: Record<string, unknown>): void {
    this.output(
      this.createEntry('error', message, {
        ...context,
        errorName: err.name,
        errorMessage: err.message,
        stack: err.stack,
      })
    );
  }
}

/**
 * Creates a logger for a specific module.
 * @param moduleName - Name of the module
 * @param verbose - Enable verbose logging
 * @returns Logger instance
 */
export function createLogger(moduleName: string, verbose = false): Logger {
  return new Logger(moduleName, verbose);
}
