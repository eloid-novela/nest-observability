import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ConsoleLogger,
  HighResolutionTimer,
  JsonFormatter,
  PrettyFormatter,
  RequestContext,
  contextStorage,
  generateRequestId,
  levelForStatus,
  runPluginHook,
  safeStringify,
  serializeError,
  serializeRequest,
  serializeResponse,
} from "../src/index.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ConsoleLogger levels and context", () => {
  it("drops entries below the configured level", () => {
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    new ConsoleLogger(undefined, { level: "info" }).debug("hidden");
    new ConsoleLogger(undefined, { level: "debug" }).debug("shown");
    new ConsoleLogger(undefined, { level: "warn" }).info("hidden");

    expect(debug).toHaveBeenCalledOnce();
    expect(info).not.toHaveBeenCalled();
  });

  it("merges default context, request context and explicit context in that order", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const logger = new ConsoleLogger(undefined, {
      defaultContext: { service: "api", requestId: "default" },
    });

    await contextStorage.run({ requestId: "req-1", path: "/users" }, async () => {
      await Promise.resolve();
      logger.info("inside", { path: "/override" });
    });

    expect(JSON.parse(info.mock.calls[0]![0] as string)).toMatchObject({
      service: "api",
      requestId: "req-1",
      path: "/override",
    });
  });

  it("can ignore the request context", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const logger = new ConsoleLogger(undefined, { useRequestContext: false });

    contextStorage.run({ requestId: "req-1" }, () => logger.info("x"));

    expect(JSON.parse(info.mock.calls[0]![0] as string).requestId).toBeUndefined();
  });

  it("serializes non-Error values passed as errors", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    new ConsoleLogger().error("failed", "boom");

    expect(JSON.parse(error.mock.calls[0]![0] as string).error).toEqual({
      name: "NonError",
      message: "boom",
    });
  });
});

describe("context", () => {
  it("returns the callback result and is undefined outside a run", () => {
    expect(contextStorage.run({}, () => 42)).toBe(42);
    expect(contextStorage.get()).toBeUndefined();
  });

  it("does not mutate the object passed to RequestContext", () => {
    const initial = { requestId: "a" };
    const context = new RequestContext(initial);

    context.set("status", 200);
    context.merge({ userId: "u1" });

    expect(initial).toEqual({ requestId: "a" });
    expect(context.data).toEqual({ requestId: "a", status: 200, userId: "u1" });
    expect(context.get("status")).toBe(200);
  });

  it("generates unique request ids", () => {
    expect(generateRequestId()).not.toBe(generateRequestId());
  });
});

describe("serialization helpers", () => {
  it("serializes errors with code and nested causes", () => {
    const root = Object.assign(new Error("db down"), { code: "ECONNREFUSED" });
    const error = new Error("query failed", { cause: root });

    expect(serializeError(error)).toMatchObject({
      name: "Error",
      message: "query failed",
      cause: { message: "db down", code: "ECONNREFUSED" },
    });
  });

  it("stringifies circular structures and bigints", () => {
    const value: Record<string, unknown> = { id: 1n, list: [1, 2] };
    value.self = value;
    const shared = { a: 1 };

    expect(JSON.parse(safeStringify({ value, x: shared, y: shared }))).toEqual({
      value: { id: "1", list: [1, 2], self: "[Circular]" },
      x: { a: 1 },
      y: { a: 1 },
    });
  });

  it("does not throw when JSON formatting a circular entry", () => {
    const entry: Record<string, unknown> = { message: "x" };
    entry.loop = entry;

    expect(() => new JsonFormatter().format(entry)).not.toThrow();
  });

  it("pretty-prints Date timestamps as ISO strings", () => {
    const line = new PrettyFormatter().format({
      timestamp: new Date("2025-01-01T00:00:00.000Z"),
      level: "info",
      message: "ok",
    });

    expect(line).toBe("2025-01-01T00:00:00.000Z INFO ok");
  });

  it("serializes HTTP requests without query strings by default", () => {
    const request = {
      method: "GET",
      originalUrl: "/users?token=secret",
      headers: { "user-agent": "vitest", "x-forwarded-for": "10.0.0.1, 10.0.0.2" },
      socket: { remoteAddress: "127.0.0.1" },
    };

    expect(serializeRequest(request)).toEqual({
      transport: "http",
      method: "GET",
      path: "/users",
      ip: "127.0.0.1",
      userAgent: "vitest",
    });
    expect(serializeRequest(request, { includeQuery: true, trustProxy: true })).toMatchObject({
      path: "/users?token=secret",
      ip: "10.0.0.1",
    });
  });

  it("serializes responses and maps statuses to levels", () => {
    expect(serializeResponse({ statusCode: 201 })).toEqual({ status: 201 });
    expect(levelForStatus(200)).toBe("info");
    expect(levelForStatus(404)).toBe("warn");
    expect(levelForStatus(503)).toBe("error");
  });
});

describe("plugins and timer", () => {
  it("runs hooks and isolates throwing plugins", () => {
    const after = vi.fn();
    const context = { requestId: "r" };

    runPluginHook(
      [{ after: () => { throw new Error("bad plugin"); } }, { after }],
      "after",
      context,
    );

    expect(after).toHaveBeenCalledWith(context);
  });

  it("measures elapsed milliseconds", () => {
    const timer = new HighResolutionTimer();
    expect(timer.elapsed()).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(timer.elapsedRounded())).toBe(true);
  });
});
