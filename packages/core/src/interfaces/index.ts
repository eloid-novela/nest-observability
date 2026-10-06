export interface LogContext {
  requestId: string;

  transport: string;

  method?: string;

  path?: string;

  status?: number;

  duration?: number;

  ip?: string;

  userAgent?: string;

  timestamp: Date;

  metadata?: Record<string, unknown>;
}


export interface Logger {
  info(
    message: string,
    context?: LogContext,
  ): void;


  warn(
    message: string,
    context?: LogContext,
  ): void;


  error(
    message: string,
    error?: Error,
    context?: LogContext,
  ): void;
}


export interface Formatter {
  format(
    context: Readonly<Record<string, unknown>>,
  ): string;
}