import { Inject, Injectable, type LoggerService } from "@nestjs/common";
import type { LogContext, Logger } from "@nestjs-observability/core";
import { OBSERVABILITY_LOGGER } from "./constants.js";

/**
 * Nest `LoggerService` backed by the structured logger, so framework logs and
 * `new Logger(MyService.name)` calls share the same format and request context.
 *
 * @example
 * const app = await NestFactory.create(AppModule, { bufferLogs: true });
 * app.useLogger(app.get(ObservabilityLogger));
 */
@Injectable()
export class ObservabilityLogger implements LoggerService {
  constructor(@Inject(OBSERVABILITY_LOGGER) private readonly logger: Logger) {}

  log(message: unknown, ...optionalParams: unknown[]): void {
    const [text, context] = this.parse(message, optionalParams);
    this.logger.info(text, context);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    const [text, context] = this.parse(message, optionalParams);
    this.logger.warn(text, context);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    const [text, context] = this.parse(message, optionalParams);
    this.logger.debug(text, context);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.debug(message, ...optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.error(message, ...optionalParams);
  }

  /** Nest calls `error(message, stack?, context?)`; an Error instance is also accepted. */
  error(message: unknown, ...optionalParams: unknown[]): void {
    const params = [...optionalParams];
    const nestContext = this.popContext(params);
    let error: unknown = message instanceof Error ? message : undefined;

    const [first] = params;
    if (first instanceof Error) {
      error = first;
    } else if (typeof first === "string" && first.includes("\n    at ")) {
      error = Object.assign(new Error(this.stringify(message)), { stack: first });
    }

    this.logger.error(this.stringify(message), error, nestContext);
  }

  private parse(message: unknown, optionalParams: unknown[]): [string, LogContext | undefined] {
    const params = [...optionalParams];
    const context = this.popContext(params);

    if (typeof message === "object" && message !== null && !(message instanceof Error)) {
      const { message: inner, ...rest } = message as Record<string, unknown>;
      return [this.stringify(inner ?? ""), { ...context, ...rest }];
    }

    return [this.stringify(message), context];
  }

  /** Nest appends the logger context (usually a class name) as the last string argument. */
  private popContext(params: unknown[]): LogContext | undefined {
    const last = params[params.length - 1];

    if (typeof last === "string" && params.length > 0) {
      params.pop();
      return { context: last };
    }

    return undefined;
  }

  private stringify(value: unknown): string {
    if (value instanceof Error) {
      return value.message;
    }

    return typeof value === "string" ? value : String(value);
  }
}
