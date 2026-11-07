import type {
  LogContext,
  Logger as LoggerInterface,
} from "../interfaces/index.js";

export abstract class BaseLogger implements LoggerInterface {
  abstract debug(message: string, context?: LogContext): void;

  abstract info(message: string, context?: LogContext): void;

  abstract warn(message: string, context?: LogContext): void;

  abstract error(message: string, error?: unknown, context?: LogContext): void;
}
