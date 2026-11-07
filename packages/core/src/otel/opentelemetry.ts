import { createRequire } from "node:module";
import type { LogContext, LogEnricher } from "../interfaces/index.js";

/** The subset of `@opentelemetry/api` used here. */
export interface OpenTelemetryApiLike {
  trace: {
    getActiveSpan():
      | { spanContext(): { traceId: string; spanId: string; traceFlags: number } }
      | undefined;
  };
  isSpanContextValid(spanContext: { traceId: string; spanId: string }): boolean;
}

/**
 * Adds `traceId`, `spanId` and `traceFlags` of the active OpenTelemetry span to
 * every log entry. `@opentelemetry/api` is an optional peer dependency: when it
 * is not installed (and no `api` is passed) the enricher does nothing.
 */
export function openTelemetryEnricher(api: OpenTelemetryApiLike | undefined = loadApi()): LogEnricher {
  if (!api) {
    return () => undefined;
  }

  return (): LogContext | undefined => {
    const spanContext = api.trace.getActiveSpan()?.spanContext();

    if (!spanContext || !api.isSpanContextValid(spanContext)) {
      return undefined;
    }

    return {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      traceFlags: spanContext.traceFlags,
    };
  };
}

export function isOpenTelemetryAvailable(): boolean {
  return loadApi() !== undefined;
}

let cachedApi: OpenTelemetryApiLike | null | undefined;

function loadApi(): OpenTelemetryApiLike | undefined {
  if (cachedApi === undefined) {
    try {
      // Resolve from the application's working directory first, so the app's own
      // copy (the one its SDK registered spans with) is used.
      const require = createRequire(`${process.cwd()}/`);
      cachedApi = require("@opentelemetry/api") as OpenTelemetryApiLike;
    } catch {
      cachedApi = null;
    }
  }

  return cachedApi ?? undefined;
}
