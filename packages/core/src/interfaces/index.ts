export type LogLevel = "debug" | "info" | "warn" | "error";

export const LOG_LEVEL_PRIORITY: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/**
 * Contextual fields attached to a log entry. Well-known HTTP fields are typed;
 * any additional key is allowed so callers can attach domain data.
 */
export interface LogContext {
  requestId?: string;
  transport?: string;
  method?: string;
  path?: string;
  status?: number;
  duration?: number;
  ip?: string;
  userAgent?: string;
  timestamp?: Date | string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SerializedError {
  name: string;
  message: string;
  stack?: string;
  code?: unknown;
  cause?: SerializedError | unknown;
}

/** A fully resolved entry, as handed to formatters. */
export interface LogEntry extends LogContext {
  level: LogLevel;
  message: string;
  timestamp: string;
  error?: SerializedError;
}

/** Called for every entry; the returned fields are merged into it (e.g. trace ids). */
export type LogEnricher = () => LogContext | undefined;

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: unknown, context?: LogContext): void;
}

export interface Formatter {
  format(entry: Readonly<Record<string, unknown>>): string;
}
