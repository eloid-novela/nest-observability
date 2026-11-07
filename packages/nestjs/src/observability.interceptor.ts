import {
  Inject,
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from "@nestjs/common";
import {
  HighResolutionTimer,
  RequestContext,
  contextStorage,
  generateRequestId,
  runPluginHook,
} from "@nestjs-observability/core";
import { Observable, catchError, tap, throwError } from "rxjs";
import { OBSERVABILITY_OPTIONS } from "./constants.js";
import type { ResolvedObservabilityOptions } from "./options.js";
import { getRequestError, recordRequestError } from "./request-errors.js";

const WS_MESSAGE_METADATA = "message";

/**
 * - HTTP: the middleware owns the context; this records handler errors on it.
 * - RPC (microservices) and WebSocket: there is no middleware, so this creates
 *   the context, runs the handler inside it and logs one line per message.
 */
@Injectable()
export class ObservabilityInterceptor implements NestInterceptor {
  constructor(
    @Inject(OBSERVABILITY_OPTIONS)
    private readonly options: ResolvedObservabilityOptions,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const type = context.getType<string>();

    if (type === "rpc" || type === "ws") {
      return this.options.transports.includes(type)
        ? this.instrumentMessage(type, context, next)
        : next.handle();
    }

    return next.handle().pipe(
      catchError((error: unknown) => {
        const requestContext = contextStorage.get();
        if (requestContext) {
          recordRequestError(requestContext, error, this.options.plugins);
        }
        return throwError(() => error);
      }),
    );
  }

  private instrumentMessage(
    transport: "rpc" | "ws",
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const requestContext = new RequestContext({
      requestId: this.resolveRequestId(transport, context),
      transport,
      path: this.resolvePattern(transport, context),
    });

    return new Observable<unknown>((subscriber) => {
      const timer = new HighResolutionTimer();

      // Subscribing inside `run` makes the handler (and everything it awaits) see the context.
      return contextStorage.run(requestContext, () => {
        runPluginHook(this.options.plugins, "before", requestContext.data);

        return next
          .handle()
          .pipe(
            tap({
              complete: () => this.complete(requestContext, timer),
              error: (error: unknown) => {
                recordRequestError(requestContext, error, this.options.plugins);
                this.complete(requestContext, timer);
              },
            }),
          )
          .subscribe(subscriber);
      });
    });
  }

  private complete(context: RequestContext, timer: HighResolutionTimer): void {
    context.set("duration", timer.elapsedRounded());
    runPluginHook(this.options.plugins, "after", context.data);

    if (!this.options.logRequests) {
      return;
    }

    const error = getRequestError(context);
    const entry = { ...context.data, timestamp: new Date() };

    if (error !== undefined) {
      this.options.logger.error("Message failed", error, entry);
    } else {
      this.options.logger.info("Message handled", entry);
    }
  }

  private resolveRequestId(transport: "rpc" | "ws", context: ExecutionContext): string {
    const data: unknown =
      transport === "rpc" ? context.switchToRpc().getData() : context.switchToWs().getData();

    if (typeof data === "object" && data !== null) {
      const candidate = (data as Record<string, unknown>).requestId;
      if (typeof candidate === "string" && candidate.length > 0 && candidate.length <= 128) {
        return candidate;
      }
    }

    return generateRequestId();
  }

  private resolvePattern(transport: "rpc" | "ws", context: ExecutionContext): string | undefined {
    if (transport === "rpc") {
      const rpcContext = context.switchToRpc().getContext() as { getPattern?: () => unknown } | undefined;
      const pattern = rpcContext?.getPattern?.();
      if (pattern !== undefined) {
        return typeof pattern === "string" ? pattern : JSON.stringify(pattern);
      }
    } else {
      const reflect = Reflect as unknown as { getMetadata?: (key: string, target: object) => unknown };
      const message = reflect.getMetadata?.(WS_MESSAGE_METADATA, context.getHandler());
      if (typeof message === "string") {
        return message;
      }
    }

    return `${context.getClass().name}.${context.getHandler().name}`;
  }
}
