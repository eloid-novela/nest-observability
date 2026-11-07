# @nestjs-observability/core

Framework-agnostic observability core: structured `ConsoleLogger` (JSON / pretty), `AsyncLocalStorage` request context, secret redaction, log enrichers, OpenTelemetry trace correlation, HTTP serializers and plugins.

```ts
import { ConsoleLogger, contextStorage } from "@nestjs-observability/core";

const logger = new ConsoleLogger(undefined, { redact: ["password"] });
contextStorage.run({ requestId: "job-42" }, () => logger.info("processing"));
```

For NestJS use [`@nestjs-observability/nestjs`](https://www.npmjs.com/package/@nestjs-observability/nestjs). Full documentation: https://github.com/eloid-novela/nest-observability#readme
