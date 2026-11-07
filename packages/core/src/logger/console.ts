import { contextStorage } from "../context/async-storage.js";
import { JsonFormatter } from "../formatter/json.js";
import {
  LOG_LEVEL_PRIORITY,
  type Formatter,
  type LogContext,
  type LogEnricher,
  type LogEntry,
  type LogLevel,
} from "../interfaces/index.js";
import { redact } from "../utils/redact.js";
import { serializeError } from "../utils/serialize-error.js";
import { BaseLogger } from "./logger.js";

export interface ConsoleLoggerOptions {
  /** Minimum level written. Defaults to "info". */
  level?: LogLevel;
  /** Fields added to every entry (service name, environment, version...). */
  defaultContext?: LogContext;
  /** Merge the active request context from `contextStorage`. Defaults to true. */
  useRequestContext?: boolean;
  /** Functions whose fields are added to every entry, e.g. `openTelemetryEnricher()`. */
  enrichers?: LogEnricher[];
  /** Keys whose values are replaced by "[REDACTED]" at any depth. Defaults to none. */
  redact?: readonly string[];
}

type Output = (line: string) => void;

const OUTPUTS: Record<LogLevel, Output> = {
  debug: (line) => console.debug(line),
  info: (line) => console.info(line),
  warn: (line) => console.warn(line),
  error: (line) => console.error(line),
};

export class ConsoleLogger extends BaseLogger {
  private readonly minPriority: number;
  private readonly defaultContext: LogContext;
  private readonly useRequestContext: boolean;
  private readonly enrichers: LogEnricher[];
  private readonly redactKeys: readonly string[];

  constructor(
    private readonly formatter: Formatter = new JsonFormatter(),
    options: ConsoleLoggerOptions = {},
  ) {
    super();
    this.minPriority = LOG_LEVEL_PRIORITY[options.level ?? "info"];
    this.defaultContext = options.defaultContext ?? {};
    this.useRequestContext = options.useRequestContext ?? true;
    this.enrichers = options.enrichers ?? [];
    this.redactKeys = options.redact ?? [];
  }

  isLevelEnabled(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= this.minPriority;
  }

  debug(message: string, context?: LogContext): void {
    this.write("debug", message, context);
  }

  info(message: string, context?: LogContext): void {
    this.write("info", message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.write("warn", message, context);
  }

  error(message: string, error?: unknown, context?: LogContext): void {
    this.write("error", message, context, error);
  }

  private write(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: unknown,
  ): void {
    if (!this.isLevelEnabled(level)) {
      return;
    }

    const requestContext = this.useRequestContext
      ? contextStorage.get()?.data
      : undefined;

    const timestamp = context?.timestamp ?? new Date();

    let entry: LogEntry = {
      ...this.defaultContext,
      ...this.enrich(),
      ...requestContext,
      ...context,
      timestamp: timestamp instanceof Date ? timestamp.toISOString() : timestamp,
      level,
      message,
    };

    if (error !== undefined) {
      entry.error = serializeError(error);
    }

    if (this.redactKeys.length > 0) {
      entry = { ...redact(entry, this.redactKeys), level, message, timestamp: entry.timestamp };
    }

    OUTPUTS[level](this.formatter.format(entry));
  }

  private enrich(): LogContext {
    const fields: LogContext = {};

    for (const enricher of this.enrichers) {
      try {
        Object.assign(fields, enricher());
      } catch {
        // An enricher must never prevent a log line from being written.
      }
    }

    return fields;
  }
}
