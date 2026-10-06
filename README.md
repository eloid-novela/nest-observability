# nest-observability

A developer-focused observability toolkit for NestJS applications. The core package currently provides structured console logging, JSON and human-readable formatters, request context storage, and a high-resolution timer.

## Logging

```ts
import {
  ConsoleLogger,
  PrettyFormatter,
} from "@nestjs-observability/core";

const logger = new ConsoleLogger(new PrettyFormatter());

logger.info("Request completed", {
  requestId: "req-123",
  transport: "http",
  timestamp: new Date(),
  method: "GET",
  path: "/health",
  status: 200,
  duration: 12.4,
});

logger.error("Request failed", new Error("Connection refused"));
```

`ConsoleLogger` uses `JsonFormatter` by default and writes each level to the matching console method. The formatter can be replaced with any implementation of `Formatter`. Error logs include the error name, message, and stack when available.

## Development

Run package commands from the repository root:

```sh
npm ci --prefix packages/core
npm run typecheck --prefix packages/core
npm run test --prefix packages/core -- --run
npm run build --prefix packages/core
```
