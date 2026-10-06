import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ConsoleLogger,
  JsonFormatter,
  PrettyFormatter,
} from "../src/index.js";

describe("ConsoleLogger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes structured info logs with a timestamp and context", () => {
    const output = vi.spyOn(console, "info").mockImplementation(() => {});
    const logger = new ConsoleLogger();
    const timestamp = new Date("2025-01-01T00:00:00.000Z");

    logger.info("request completed", {
      requestId: "request-1",
      transport: "http",
      timestamp,
      status: 200,
    });

    expect(output).toHaveBeenCalledOnce();
    expect(JSON.parse(output.mock.calls[0][0] as string)).toEqual({
      timestamp: timestamp.toISOString(),
      requestId: "request-1",
      transport: "http",
      status: 200,
      level: "info",
      message: "request completed",
    });
  });

  it("uses the matching console method and preserves error details", () => {
    const output = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("connection failed");
    const logger = new ConsoleLogger();

    logger.error("request failed", error);

    const entry = JSON.parse(output.mock.calls[0][0] as string);
    expect(entry).toMatchObject({
      level: "error",
      message: "request failed",
      error: {
        name: "Error",
        message: "connection failed",
        stack: error.stack,
      },
    });
    expect(entry.timestamp).toEqual(expect.any(String));
  });

  it("supports a custom formatter", () => {
    const output = vi.spyOn(console, "warn").mockImplementation(() => {});
    const formatter = { format: vi.fn(() => "formatted") };
    const logger = new ConsoleLogger(formatter);

    logger.warn("slow request");

    expect(formatter.format).toHaveBeenCalledWith(expect.objectContaining({
      level: "warn",
      message: "slow request",
    }));
    expect(output).toHaveBeenCalledWith("formatted");
  });
});

describe("formatters", () => {
  it("adds a timestamp when formatting JSON without one", () => {
    const result = JSON.parse(new JsonFormatter().format({
      message: "hello",
      timestamp: undefined,
    }));

    expect(result).toMatchObject({ message: "hello" });
    expect(result.timestamp).toEqual(expect.any(String));
  });

  it("formats log messages and keeps zero-valued status codes", () => {
    expect(new PrettyFormatter().format({
      level: "info",
      message: "request completed",
      status: 0,
      duration: 3,
    })).toContain("INFO request completed 0 3ms");
  });
});
