import {
  ConsoleLogger,
  DEFAULT_REDACT_KEYS,
  JsonFormatter,
  PrettyFormatter,
  openTelemetryEnricher,
  type LogContext,
  type LogLevel,
  type Logger,
  type LoggerPlugin,
} from "@nestjs-observability/core";
import { DEFAULT_REQUEST_ID_HEADER } from "./constants.js";

export type ObservabilityTransport = "http" | "rpc" | "ws";

export interface ObservabilityModuleOptions {
  /** Custom logger. When omitted a ConsoleLogger is built from the options below. */
  logger?: Logger;
  /** Output format of the default logger. Defaults to "json". */
  format?: "json" | "pretty";
  /** Minimum level of the default logger. Defaults to "info". */
  level?: LogLevel;
  /** Fields added to every log entry (service, env, version...). */
  defaultContext?: LogContext;
  /**
   * Keys redacted at any depth by the default logger. Defaults to DEFAULT_REDACT_KEYS
   * (authorization, cookie, password, token...). Pass `false` to disable.
   */
  redact?: readonly string[] | false;
  /**
   * Add `traceId`/`spanId` of the active OpenTelemetry span to every entry of the
   * default logger. Defaults to true; a no-op when `@opentelemetry/api` isn't installed.
   */
  openTelemetry?: boolean;
  /** Header read for an incoming request id and echoed on the response. Defaults to "x-request-id". */
  requestIdHeader?: string;
  /** Write one log line per completed request/message. Defaults to true. */
  logRequests?: boolean;
  /** Transports that are instrumented. Defaults to all: ["http", "rpc", "ws"]. */
  transports?: ObservabilityTransport[];
  /** HTTP path prefixes that are not logged (e.g. "/health"). Context is still created. */
  excludePaths?: string[];
  /** Include the query string in the logged path. Defaults to false. */
  includeQuery?: boolean;
  /** Resolve the client ip from `x-forwarded-for` when the framework didn't. Defaults to false. */
  trustProxy?: boolean;
  /** Request lifecycle hooks. */
  plugins?: LoggerPlugin[];
}

export interface ResolvedObservabilityOptions {
  logger: Logger;
  requestIdHeader: string;
  logRequests: boolean;
  transports: ObservabilityTransport[];
  excludePaths: string[];
  includeQuery: boolean;
  trustProxy: boolean;
  plugins: LoggerPlugin[];
}

export function resolveOptions(
  options: ObservabilityModuleOptions = {},
): ResolvedObservabilityOptions {
  const logger =
    options.logger ??
    new ConsoleLogger(
      options.format === "pretty" ? new PrettyFormatter() : new JsonFormatter(),
      {
        level: options.level,
        defaultContext: options.defaultContext,
        redact: options.redact === false ? [] : (options.redact ?? DEFAULT_REDACT_KEYS),
        enrichers: options.openTelemetry === false ? [] : [openTelemetryEnricher()],
      },
    );

  return {
    logger,
    requestIdHeader: (options.requestIdHeader ?? DEFAULT_REQUEST_ID_HEADER).toLowerCase(),
    logRequests: options.logRequests ?? true,
    transports: options.transports ?? ["http", "rpc", "ws"],
    excludePaths: options.excludePaths ?? [],
    includeQuery: options.includeQuery ?? false,
    trustProxy: options.trustProxy ?? false,
    plugins: options.plugins ?? [],
  };
}
