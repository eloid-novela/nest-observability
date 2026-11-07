# nest-observability

Observability toolkit for NestJS: structured logging, per-request context propagation (the request id is available everywhere without passing it around), one log line per HTTP request / microservice message / WebSocket message, secret redaction and OpenTelemetry trace correlation.

| Package | Description |
| --- | --- |
| [`@nestjs-observability/core`](packages/core) | Framework-agnostic: `ConsoleLogger`, JSON / pretty formatters, `AsyncLocalStorage` request context, redaction, enrichers, OpenTelemetry, HTTP serializers, plugins. |
| [`@nestjs-observability/nestjs`](packages/nestjs) | NestJS integration: `ObservabilityModule`, request-context middleware, interceptor (HTTP, RPC, WS), exception filter, Nest `LoggerService` adapter. |

Both packages ship ESM and CommonJS builds and work with NestJS 10 and 11 on Node.js 20+.

- [Installing during development](#installing-during-development)
- [NestJS quick start](#nestjs-quick-start)
- [Options](#options)
- [Microservices and WebSockets](#microservices-and-websockets)
- [Redaction](#redaction)
- [OpenTelemetry](#opentelemetry)
- [Plugins](#plugins)
- [Core without NestJS](#core-without-nestjs)
- [Contributing and releasing](#contributing-and-releasing)

## Installing during development

The packages are not on npm yet. Until they are, there are two ways to use them in another project (the "consumer"). The examples assume this layout; adjust the relative paths to yours:

```
projects/
├── nest-observability/   ← this repository
└── my-api/               ← your NestJS project
```

First, once, in this repository:

```sh
cd nest-observability
npm ci
```

### Option A: local tarballs (recommended)

This installs exactly what `npm publish` would ship, as real copies, so it behaves like the published packages.

```sh
# 1. In nest-observability: build both packages and pack them into .packs/
npm run pack:local

# 2. In my-api: install both tarballs in the same command
cd ../my-api
npm install ../nest-observability/.packs/nestjs-observability-core-0.1.0.tgz \
            ../nest-observability/.packs/nestjs-observability-nestjs-0.1.0.tgz
```

Install **both** tarballs together. `@nestjs-observability/nestjs` depends on `@nestjs-observability/core`, and if core isn't installed in the same command npm looks for it on the npm registry, where it doesn't exist yet.

Your `package.json` now contains `"file:../nest-observability/.packs/…tgz"` entries. After changing code in this repository, run both steps again (`npm run pack:local`, then the same `npm install`). npm replaces the installed copy even though the version number is unchanged.

### Option B: symlinks with live rebuilds

Use this when you change the packages often and want each change to show up in the consumer without reinstalling.

```sh
# 1. In my-api: link the package folders (creates symlinks in node_modules)
npm install ../nest-observability/packages/core ../nest-observability/packages/nestjs

# 2. In nest-observability: rebuild both packages on every change
npm run dev
```

> **Required: run the consumer with `--preserve-symlinks`.**
> Through a symlink, Node resolves `@nestjs/core` and `@nestjs/common` from *this* repository's `node_modules`, so your app ends up with two copies of Nest. Dependency injection and `instanceof HttpException` then break: for example, a `403` from a guard turns into a `500` and the exception filter crashes. `--preserve-symlinks` makes Node resolve them from the consumer's `node_modules`, so there is a single copy.

```sh
# bash / zsh
NODE_OPTIONS=--preserve-symlinks npm run start:dev
```

```powershell
# PowerShell
$env:NODE_OPTIONS="--preserve-symlinks"; npm run start:dev
```

If you use `nest build` / `tsc`, also add `"preserveSymlinks": true` to the consumer's `tsconfig.json` `compilerOptions`, so the TypeScript types are also resolved from the consumer's `node_modules`.

### Switching to the published packages

Once the packages are on npm, replace the local references:

```sh
npm uninstall @nestjs-observability/core @nestjs-observability/nestjs
npm install @nestjs-observability/core @nestjs-observability/nestjs
```

Then remove `--preserve-symlinks` / `preserveSymlinks` if you used Option B.

## NestJS quick start

```sh
npm install @nestjs-observability/nestjs @nestjs-observability/core
# optional, for trace correlation:
npm install @opentelemetry/api
```

```ts
// app.module.ts
import { Module } from "@nestjs/common";
import { ObservabilityModule } from "@nestjs-observability/nestjs";

@Module({
  imports: [
    ObservabilityModule.forRoot({
      format: process.env.NODE_ENV === "production" ? "json" : "pretty",
      level: "info",
      defaultContext: { service: "users-api" },
      excludePaths: ["/health"],
    }),
  ],
})
export class AppModule {}
```

```ts
// main.ts: route Nest's own logs (and `new Logger(...)`) through the structured logger
import { NestFactory } from "@nestjs/core";
import { ObservabilityLogger } from "@nestjs-observability/nestjs";

const app = await NestFactory.create(AppModule, { bufferLogs: true });
app.useLogger(app.get(ObservabilityLogger));
await app.listen(3000);
```

Every HTTP request then gets:

- a request id, taken from `x-request-id` when it is safe (≤128 chars, `[A-Za-z0-9_.:-]`) or generated, and echoed on the response;
- a context (`requestId`, `method`, `path`, `ip`, `userAgent`) that every log written during the request includes automatically;
- one completion line with `status` and `duration`: `info` for 2xx/3xx, `warn` for 4xx, `error` for 5xx. The `error` line includes the exception, also when it is thrown by a guard, pipe or middleware.

```
{"service":"users-api","requestId":"abc-1","transport":"http","method":"GET","path":"/users","ip":"::1","userAgent":"curl/8.4.0","password":"[REDACTED]","timestamp":"…","level":"info","message":"loading user"}
{"service":"users-api","requestId":"abc-1","transport":"http","method":"GET","path":"/users","ip":"::1","userAgent":"curl/8.4.0","status":200,"duration":12.7,"timestamp":"…","level":"info","message":"Request completed"}
```

To log from your own services, inject the logger:

```ts
import { Inject, Injectable } from "@nestjs/common";
import type { Logger } from "@nestjs-observability/core";
import { OBSERVABILITY_LOGGER } from "@nestjs-observability/nestjs";

@Injectable()
export class UsersService {
  constructor(@Inject(OBSERVABILITY_LOGGER) private readonly logger: Logger) {}

  find(id: string) {
    this.logger.info("loading user", { userId: id }); // requestId is added automatically
  }
}
```

### Async configuration

```ts
ObservabilityModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    level: config.get("LOG_LEVEL", "info"),
    defaultContext: { service: config.get("SERVICE_NAME") },
  }),
  captureExceptions: true, // registration option, set outside the factory
});
```

## Options

| Option | Default | Description |
| --- | --- | --- |
| `logger` | `ConsoleLogger` | Any implementation of the core `Logger` interface. When set, `format`, `level`, `defaultContext`, `redact` and `openTelemetry` are ignored. |
| `format` | `"json"` | `"json"` or `"pretty"`. |
| `level` | `"info"` | `debug`, `info`, `warn` or `error`. |
| `defaultContext` | `{}` | Fields added to every entry. |
| `redact` | `DEFAULT_REDACT_KEYS` | Keys whose values become `"[REDACTED]"`; `false` disables redaction. |
| `openTelemetry` | `true` | Add `traceId`/`spanId` of the active span (no-op without `@opentelemetry/api`). |
| `requestIdHeader` | `"x-request-id"` | Header read and echoed for the request id. |
| `logRequests` | `true` | Write the per-request / per-message completion line. |
| `transports` | `["http", "rpc", "ws"]` | Transports that are instrumented. |
| `excludePaths` | `[]` | HTTP path prefixes not logged (context is still created). |
| `includeQuery` | `false` | Log the query string (off by default to avoid leaking tokens). |
| `trustProxy` | `false` | Use `x-forwarded-for` when the framework did not resolve `ip`. |
| `plugins` | `[]` | `LoggerPlugin` hooks: `before`, `after`, `error`. |
| `captureExceptions` | `true` | Registers a global catch-all exception filter (see below). |

`captureExceptions` registers `ObservabilityExceptionFilter`. The filter records the exception and then responds exactly like Nest's built-in handlers (HTTP, RPC and WS), so responses don't change. Filters you register yourself still take precedence for the exceptions they catch. If you already have your own catch-all `@Catch()` filter, set `captureExceptions: false`; errors thrown inside handlers are still captured by the interceptor.

## Microservices and WebSockets

In a pure microservice (`NestFactory.createMicroservice`) and in WebSocket gateways, every message gets its own context and one line: `Message handled` (`info`) or `Message failed` (`error`, with the exception). Each line includes `transport` (`rpc`/`ws`), `path` (the message pattern) and `duration`.

The request id is taken from a `requestId` field of the payload when present, so ids propagate across services:

```ts
// caller (HTTP request handler)
this.client.send({ cmd: "sum" }, { requestId: contextStorage.get()?.requestId, values });
```

In a **hybrid** application (`app.connectMicroservice`), Nest applies global interceptors and filters to the microservice only when you pass `inheritAppConfig`:

```ts
app.connectMicroservice(options, { inheritAppConfig: true });
```

## Redaction

The default logger replaces the values of sensitive keys at any depth, case-insensitively, without mutating your objects. The default keys are `authorization`, `cookie`, `set-cookie`, `password`, `secret`, `token`, `accessToken`, `refreshToken`, `apiKey`, `x-api-key`, `clientSecret`, `privateKey`, `cardNumber`, `cvv` and similar.

```ts
import { DEFAULT_REDACT_KEYS } from "@nestjs-observability/core";

ObservabilityModule.forRoot({ redact: [...DEFAULT_REDACT_KEYS, "ssn", "iban"] });
```

## OpenTelemetry

When `@opentelemetry/api` is installed and a span is active, every entry gets `traceId`, `spanId` and `traceFlags`, so logs and traces can be correlated in your backend (Grafana, Datadog, Honeycomb, etc.). Nothing to configure. Set `openTelemetry: false` to turn it off.

Outside NestJS, add the enricher yourself:

```ts
new ConsoleLogger(new JsonFormatter(), { enrichers: [openTelemetryEnricher()] });
```

## Plugins

Plugins receive the live request context, so they can enrich it before the completion line is written. A throwing plugin never breaks the request.

```ts
const userPlugin: LoggerPlugin = {
  after(context) {
    context.userId = currentUserId(); // appears on the completion line
  },
  error(error, context) {
    metrics.increment("http.errors", { path: context.path });
  },
};
```

## Core without NestJS

```ts
import { ConsoleLogger, PrettyFormatter, contextStorage } from "@nestjs-observability/core";

const logger = new ConsoleLogger(new PrettyFormatter(), {
  level: "debug",
  redact: ["password"],
  enrichers: [() => ({ pid: process.pid })],
});

contextStorage.run({ requestId: "job-42", transport: "queue" }, async () => {
  logger.info("processing"); // includes requestId, transport and pid
  logger.error("failed", new Error("Connection refused"));
});
```

Errors are serialized with `name`, `message`, `stack`, `code` and nested `cause`. The JSON formatter never throws on circular references or bigints. The request context is a process-wide singleton shared by the ESM and CommonJS builds.

## Contributing and releasing

This is an npm workspaces monorepo. Run these commands from the repository root:

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run dev          # rebuild both packages on change
npm run pack:local   # build and write installable tarballs to .packs/
```

Releases use [changesets](https://github.com/changesets/changesets):

1. In your PR, run `npx changeset`, choose the packages and the bump type, and commit the generated file.
2. On merge to `main`, the [release workflow](.github/workflows/release.yml) opens a "Version Packages" PR that bumps versions and writes the changelogs.
3. Merging that PR publishes to npm. This requires an `NPM_TOKEN` repository secret with publish rights to the `@nestjs-observability` scope.

Unpublished versions (the current `0.1.0`) are published on the first run, with no changeset needed.
