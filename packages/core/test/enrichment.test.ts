import { context, trace } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { BasicTracerProvider } from "@opentelemetry/sdk-trace-base";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  ConsoleLogger,
  DEFAULT_REDACT_KEYS,
  REDACTED,
  contextStorage,
  isOpenTelemetryAvailable,
  openTelemetryEnricher,
  redact,
} from "../src/index.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function captureInfo() {
  const info = vi.spyOn(console, "info").mockImplementation(() => {});
  return () => JSON.parse(info.mock.calls[info.mock.calls.length - 1]![0] as string);
}

describe("redaction", () => {
  it("redacts matching keys at any depth, case-insensitively, without mutating input", () => {
    const input = {
      user: "ana",
      headers: { Authorization: "Bearer abc", accept: "json" },
      list: [{ password: "p" }, { ok: 1 }],
    };

    expect(redact(input, DEFAULT_REDACT_KEYS)).toEqual({
      user: "ana",
      headers: { Authorization: REDACTED, accept: "json" },
      list: [{ password: REDACTED }, { ok: 1 }],
    });
    expect(input.headers.Authorization).toBe("Bearer abc");
  });

  it("handles circular structures and leaves class instances alone", () => {
    const circular: Record<string, unknown> = { token: "t" };
    circular.self = circular;
    const date = new Date(0);

    const result = redact({ circular, date }, ["token"]) as { circular: Record<string, unknown>; date: Date };

    expect(result.circular.token).toBe(REDACTED);
    expect(result.date).toBe(date);
  });

  it("is applied by ConsoleLogger to every source of fields", () => {
    const last = captureInfo();
    const logger = new ConsoleLogger(undefined, {
      redact: ["apiKey", "message"],
      defaultContext: { apiKey: "from-default" },
    });

    contextStorage.run({ metadata: { apiKey: "from-request" } }, () =>
      logger.info("kept", { nested: { apiKey: "explicit" } }),
    );

    expect(last()).toMatchObject({
      message: "kept",
      apiKey: REDACTED,
      metadata: { apiKey: REDACTED },
      nested: { apiKey: REDACTED },
    });
  });
});

describe("enrichers", () => {
  it("merges enricher fields and ignores throwing enrichers", () => {
    const last = captureInfo();
    const logger = new ConsoleLogger(undefined, {
      enrichers: [
        () => ({ region: "eu" }),
        () => {
          throw new Error("broken");
        },
      ],
    });

    logger.info("x", { explicit: true });

    expect(last()).toMatchObject({ region: "eu", explicit: true });
  });
});

describe("OpenTelemetry", () => {
  const contextManager = new AsyncLocalStorageContextManager();
  const tracer = new BasicTracerProvider().getTracer("test");

  beforeAll(() => {
    context.setGlobalContextManager(contextManager.enable());
  });

  afterAll(() => {
    context.disable();
  });

  it("is detected when @opentelemetry/api is installed", () => {
    expect(isOpenTelemetryAvailable()).toBe(true);
  });

  it("adds the active span's trace and span ids", async () => {
    const last = captureInfo();
    const logger = new ConsoleLogger(undefined, { enrichers: [openTelemetryEnricher()] });
    const span = tracer.startSpan("operation");

    await context.with(trace.setSpan(context.active(), span), async () => {
      await Promise.resolve();
      logger.info("traced");
    });
    span.end();

    expect(last()).toMatchObject({
      traceId: span.spanContext().traceId,
      spanId: span.spanContext().spanId,
      traceFlags: 1,
    });
  });

  it("adds nothing outside a span or when the API is missing", () => {
    expect(openTelemetryEnricher()()).toBeUndefined();
    expect(openTelemetryEnricher(undefined)()).toBeUndefined();
  });
});

describe("context storage singleton", () => {
  it("is shared through globalThis", () => {
    const key = Symbol.for("@nestjs-observability/core:contextStorage");
    expect((globalThis as Record<symbol, unknown>)[key]).toBe(contextStorage);
  });
});
