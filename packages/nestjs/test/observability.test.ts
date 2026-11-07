import "reflect-metadata";
import {
  Controller,
  Get,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger as NestLogger,
  NotFoundException,
  ServiceUnavailableException,
  UseGuards,
  type CanActivate,
  type INestApplication,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  contextStorage,
  type LogContext,
  type Logger,
} from "@nestjs-observability/core";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OBSERVABILITY_LOGGER,
  ObservabilityLogger,
  ObservabilityModule,
  type ObservabilityModuleOptions,
  type ObservabilityRegistrationOptions,
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

class DenyGuard implements CanActivate {
  canActivate(): boolean {
    throw new ServiceUnavailableException("auth service down");
  }
}

@Injectable()
class UsersService {
  constructor(@Inject(OBSERVABILITY_LOGGER) private readonly logger: Logger) {}

  async find(id: string) {
    await new Promise((resolve) => setTimeout(resolve, 1));
    this.logger.info("loading user", { userId: id });
    return { id, requestId: contextStorage.get()?.requestId };
  }
}

@Controller()
class TestController {
  constructor(@Inject(UsersService) private readonly users: UsersService) {}

  @Get("users")
  users_() {
    return this.users.find("42");
  }

  @Get("missing")
  missing() {
    throw new NotFoundException();
  }

  @Get("boom")
  boom() {
    throw new InternalServerErrorException("database unavailable");
  }

  @Get("health")
  health() {
    return { ok: true };
  }

  @Get("private")
  @UseGuards(DenyGuard)
  private_() {
    return { secret: true };
  }
}

async function createApp(
  options: ObservabilityModuleOptions & ObservabilityRegistrationOptions = {},
) {
  const logger = memoryLogger();
  const moduleRef = await Test.createTestingModule({
    imports: [ObservabilityModule.forRoot({ logger, ...options })],
    controllers: [TestController],
    providers: [UsersService],
  }).compile();

  const app = moduleRef.createNestApplication({ logger: false });
  await app.init();
  return { app, logger };
}

/** Completion logs are written on the response "finish" event. */
async function settle() {
  await new Promise((resolve) => setImmediate(resolve));
}

describe("ObservabilityModule", () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("propagates a generated request id to services and the response", async () => {
    const created = await createApp();
    app = created.app;

    const response = await request(app.getHttpServer()).get("/users").expect(200);
    await settle();

    const requestId = response.headers["x-request-id"];
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.body).toEqual({ id: "42", requestId });

    const [serviceLog, completion] = created.logger.entries;
    expect(serviceLog).toMatchObject({
      message: "loading user",
      context: { requestId, userId: "42", method: "GET", path: "/users" },
    });
    expect(completion).toMatchObject({
      level: "info",
      message: "Request completed",
      context: { requestId, status: 200, transport: "http" },
    });
    expect(completion?.context?.duration).toEqual(expect.any(Number));
  });

  it("reuses a valid incoming request id and rejects unsafe ones", async () => {
    const created = await createApp();
    app = created.app;

    await request(app.getHttpServer())
      .get("/health")
      .set("x-request-id", "abc-123")
      .expect("x-request-id", "abc-123");

    const unsafe = await request(app.getHttpServer())
      .get("/health")
      .set("x-request-id", "bad id\" injected");

    expect(unsafe.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("logs 4xx as warn and 5xx as error with the thrown exception", async () => {
    const created = await createApp();
    app = created.app;

    await request(app.getHttpServer()).get("/missing").expect(404);
    await request(app.getHttpServer()).get("/boom").expect(500);
    await settle();

    const [notFound, failure] = created.logger.entries;
    expect(notFound).toMatchObject({ level: "warn", context: { status: 404 } });
    expect(failure).toMatchObject({ level: "error", message: "Request failed", context: { status: 500 } });
    expect(failure?.error).toBeInstanceOf(InternalServerErrorException);
    expect(Object.values(failure?.context ?? {})).not.toContain(failure?.error);
  });

  it("captures exceptions thrown by guards without changing the response", async () => {
    const created = await createApp();
    app = created.app;

    const response = await request(app.getHttpServer()).get("/private").expect(503);
    await settle();

    expect(response.body).toEqual({
      statusCode: 503,
      message: "auth service down",
      error: "Service Unavailable",
    });
    expect(created.logger.entries[0]).toMatchObject({ level: "error", context: { status: 503 } });
    expect(created.logger.entries[0]?.error).toBeInstanceOf(ServiceUnavailableException);
  });

  it("does not capture guard exceptions when captureExceptions is false", async () => {
    const created = await createApp({ captureExceptions: false });
    app = created.app;

    await request(app.getHttpServer()).get("/private").expect(503);
    await settle();

    expect(created.logger.entries[0]?.error).toBeUndefined();
  });

  it("skips excluded paths and runs plugins", async () => {
    const plugin = { before: vi.fn(), after: vi.fn(), error: vi.fn() };
    const created = await createApp({
      excludePaths: ["/health"],
      plugins: [
        plugin,
        { before: (context) => Object.assign(context, { tenant: "acme" }) },
      ],
    });
    app = created.app;

    await request(app.getHttpServer()).get("/health").expect(200);
    await request(app.getHttpServer()).get("/boom").expect(500);
    await settle();

    expect(created.logger.entries).toHaveLength(1);
    expect(created.logger.entries[0]?.context).toMatchObject({ path: "/boom", tenant: "acme" });
    expect(plugin.before).toHaveBeenCalledTimes(2);
    expect(plugin.after).toHaveBeenCalledTimes(2);
    expect(plugin.error).toHaveBeenCalledOnce();
  });

  it("supports async configuration", async () => {
    const logger = memoryLogger();
    const moduleRef = await Test.createTestingModule({
      imports: [
        ObservabilityModule.forRootAsync({
          useFactory: async () => ({ logger, requestIdHeader: "X-Correlation-Id" }),
        }),
      ],
      controllers: [TestController],
      providers: [UsersService],
    }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    await app.init();

    await request(app.getHttpServer())
      .get("/health")
      .set("x-correlation-id", "corr-1")
      .expect("x-correlation-id", "corr-1");
  });
});

describe("ObservabilityLogger", () => {
  it("maps Nest logger calls to structured logs", () => {
    const logger = memoryLogger();
    const nest = new ObservabilityLogger(logger);
    const error = new Error("boom");

    nest.log("bootstrapped", "NestApplication");
    nest.verbose({ message: "detail", userId: 1 }, "UsersService");
    nest.error("failed", error.stack, "ExceptionsHandler");
    nest.fatal(error);

    expect(logger.entries).toEqual([
      { level: "info", message: "bootstrapped", context: { context: "NestApplication" } },
      { level: "debug", message: "detail", context: { context: "UsersService", userId: 1 } },
      {
        level: "error",
        message: "failed",
        error: expect.objectContaining({ stack: error.stack }),
        context: { context: "ExceptionsHandler" },
      },
      { level: "error", message: "boom", error, context: {} },
    ]);
  });

  it("can be used as the application logger", async () => {
    const logger = memoryLogger();
    const moduleRef = await Test.createTestingModule({
      imports: [ObservabilityModule.forRoot({ logger })],
    }).compile();
    const app = moduleRef.createNestApplication({ bufferLogs: true });
    app.useLogger(app.get(ObservabilityLogger));
    await app.init();

    new NestLogger("Bootstrap").log("ready");
    await app.close();

    expect(logger.entries).toContainEqual(
      expect.objectContaining({ message: "ready", context: { context: "Bootstrap" } }),
    );
  });
});
