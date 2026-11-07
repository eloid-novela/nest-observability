import "reflect-metadata";
import { createServer } from "node:net";
import { Controller, Inject, type ExecutionContext, type INestMicroservice } from "@nestjs/common";
import {
  ClientProxyFactory,
  MessagePattern,
  RpcException,
  Transport,
  type ClientProxy,
} from "@nestjs/microservices";
import { Test } from "@nestjs/testing";
import { contextStorage, type LogContext, type Logger } from "@nestjs-observability/core";
import { firstValueFrom, lastValueFrom, of, throwError } from "rxjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  OBSERVABILITY_LOGGER,
  ObservabilityExceptionFilter,
  ObservabilityInterceptor,
  ObservabilityModule,
  resolveOptions,
} from "../src/index.js";

interface Captured {
  level: string;
  message: string;
  context?: LogContext;
  error?: unknown;
}

function memoryLogger(): Logger & { entries: Captured[] } {
  const entries: Captured[] = [];
  const merge = (context?: LogContext) => ({ ...contextStorage.get()?.data, ...context });

  return {
    entries,
    debug: (message, context) => entries.push({ level: "debug", message, context: merge(context) }),
    info: (message, context) => entries.push({ level: "info", message, context: merge(context) }),
    warn: (message, context) => entries.push({ level: "warn", message, context: merge(context) }),
    error: (message, error, context) =>
      entries.push({ level: "error", message, error, context: merge(context) }),
  };
}

/** Asks the OS for an unused port. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(typeof address === "object" && address ? address.port : 0));
    });
  });
}

@Controller()
class MathController {
  constructor(@Inject(OBSERVABILITY_LOGGER) private readonly logger: Logger) {}

  @MessagePattern({ cmd: "sum" })
  async sum(data: { values: number[] }) {
    await new Promise((resolve) => setTimeout(resolve, 1));
    this.logger.info("summing");
    return data.values.reduce((total, value) => total + value, 0);
  }

  @MessagePattern("invalid")
  invalid() {
    throw new RpcException("bad input");
  }

  @MessagePattern("crash")
  crash() {
    throw new Error("secret internal detail");
  }
}

describe("RPC transport (TCP microservice)", () => {
  const logger = memoryLogger();
  let port: number;
  let microservice: INestMicroservice;
  let client: ClientProxy;

  beforeAll(async () => {
    port = await freePort();
    const moduleRef = await Test.createTestingModule({
      imports: [ObservabilityModule.forRoot({ logger })],
      controllers: [MathController],
    }).compile();

    microservice = moduleRef.createNestMicroservice({
      transport: Transport.TCP,
      options: { host: "127.0.0.1", port },
      logger: false,
    });
    await microservice.listen();

    client = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host: "127.0.0.1", port },
    });
    await client.connect();
  });

  afterAll(async () => {
    client?.close();
    await microservice?.close();
  });

  it("propagates the request id from the payload and logs the message", async () => {
    logger.entries.length = 0;

    const result = await firstValueFrom(
      client.send({ cmd: "sum" }, { requestId: "rpc-1", values: [1, 2, 3] }),
    );

    expect(result).toBe(6);
    expect(logger.entries).toEqual([
      expect.objectContaining({
        message: "summing",
        context: expect.objectContaining({ requestId: "rpc-1", transport: "rpc" }),
      }),
      expect.objectContaining({
        level: "info",
        message: "Message handled",
        context: expect.objectContaining({
          requestId: "rpc-1",
          transport: "rpc",
          path: JSON.stringify({ cmd: "sum" }),
          duration: expect.any(Number),
        }),
      }),
    ]);
  });

  it("logs failures and keeps Nest's RPC error responses", async () => {
    logger.entries.length = 0;

    await expect(firstValueFrom(client.send("invalid", {}))).rejects.toEqual({
      status: "error",
      message: "bad input",
    });
    await expect(firstValueFrom(client.send("crash", {}))).rejects.toEqual({
      status: "error",
      message: "Internal server error",
    });

    expect(logger.entries.map((entry) => [entry.level, entry.message, entry.context?.path])).toEqual([
      ["error", "Message failed", "invalid"],
      ["error", "Message failed", "crash"],
    ]);
    expect(logger.entries[1]?.error).toBeInstanceOf(Error);
  });
});

describe("WebSocket transport", () => {
  class ChatGateway {
    handle() {}
  }
  Reflect.defineMetadata("message", "chat:send", ChatGateway.prototype.handle);

  function wsContext(data: unknown, client: unknown = {}): ExecutionContext {
    return {
      getType: () => "ws",
      getClass: () => ChatGateway,
      getHandler: () => ChatGateway.prototype.handle,
      switchToWs: () => ({ getData: () => data, getClient: () => client, getPattern: () => "chat:send" }),
    } as unknown as ExecutionContext;
  }

  it("creates a context per message and logs it", async () => {
    const logger = memoryLogger();
    const interceptor = new ObservabilityInterceptor(resolveOptions({ logger }));

    const result = await lastValueFrom(
      interceptor.intercept(wsContext({ requestId: "ws-1" }), {
        handle: () => of(contextStorage.get()?.requestId),
      }),
    );

    expect(result).toBe("ws-1");
    expect(logger.entries[0]).toMatchObject({
      level: "info",
      message: "Message handled",
      context: { requestId: "ws-1", transport: "ws", path: "chat:send" },
    });
  });

  it("logs handler errors and emits Nest's default exception event", async () => {
    const logger = memoryLogger();
    const options = resolveOptions({ logger });
    const interceptor = new ObservabilityInterceptor(options);
    const emitted: unknown[] = [];
    const client = { emit: (event: string, payload: unknown) => emitted.push([event, payload]) };
    const failure = new Error("boom");

    await expect(
      lastValueFrom(interceptor.intercept(wsContext({}, client), { handle: () => throwError(() => failure) })),
    ).rejects.toBe(failure);

    new ObservabilityExceptionFilter(options).catch(failure, {
      getType: () => "ws",
      switchToWs: () => ({ getClient: () => client }),
    } as never);

    expect(logger.entries[0]).toMatchObject({ level: "error", message: "Message failed", error: failure });
    expect(emitted).toEqual([["exception", { status: "error", message: "Internal server error" }]]);
  });

  it("can be disabled per transport", async () => {
    const logger = memoryLogger();
    const interceptor = new ObservabilityInterceptor(resolveOptions({ logger, transports: ["http"] }));

    await lastValueFrom(interceptor.intercept(wsContext({}), { handle: () => of(1) }));

    expect(logger.entries).toHaveLength(0);
  });
});
