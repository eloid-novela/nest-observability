import type {
  LogContext,
  Formatter,
} from "../interfaces/index.js";
import {
  JsonFormatter,
} from "../formatter/json.js";
import {
  BaseLogger,
} from "./logger.js";

export class ConsoleLogger extends BaseLogger {
  constructor(
    private readonly formatter: Formatter = new JsonFormatter(),
  ) {
    super();
  }

  info(message: string, context?: LogContext): void {
    this.write("info", console.info, message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.write("warn", console.warn, message, context);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.write("error", console.error, message, context, error);
  }

  private write(
    level: "info" | "warn" | "error",
    output: (...data: unknown[]) => void,
    message: string,
    context?: LogContext,
    error?: Error,
  ): void {
    const entry: Record<string, unknown> = {
      ...context,
      timestamp: context?.timestamp ?? new Date().toISOString(),
      level,
      message,
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    output(this.formatter.format(entry));
  }
}