# @nestjs-observability/nestjs

NestJS integration for [`@nestjs-observability/core`](https://www.npmjs.com/package/@nestjs-observability/core): request id and context propagation, one log line per HTTP request / microservice message / WebSocket message, exception capture (including guards and pipes), secret redaction, OpenTelemetry correlation and a structured `LoggerService`.

```ts
@Module({
  imports: [ObservabilityModule.forRoot({ format: "json", defaultContext: { service: "users-api" } })],
})
export class AppModule {}
```

Full documentation, options and how to install it locally during development: https://github.com/eloid-novela/nest-observability#readme
