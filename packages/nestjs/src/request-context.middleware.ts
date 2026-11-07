import { Inject, Injectable, type NestMiddleware } from "@nestjs/common";
import {
  HighResolutionTimer,
  RequestContext,
  contextStorage,
  generateRequestId,
  getHeader,
  levelForStatus,
  runPluginHook,
  serializeRequest,
  type HttpRequestLike,
} from "@nestjs-observability/core";
import { OBSERVABILITY_OPTIONS } from "./constants.js";
import type { ResolvedObservabilityOptions } from "./options.js";
import { getRequestError } from "./request-errors.js";

interface HttpResponse {
  statusCode: number;
  headersSent?: boolean;
  setHeader(name: string, value: string): unknown;
  once(event: "finish" | "close", listener: () => void): unknown;
}

const MAX_REQUEST_ID_LENGTH = 128;
const SAFE_REQUEST_ID = /^[\w.:-]+$/;

/**
 * Creates the request context (request id, method, path, ip...), propagates it
 * via AsyncLocalStorage and logs one line when the response finishes.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(
    @Inject(OBSERVABILITY_OPTIONS)
    private readonly options: ResolvedObservabilityOptions,
  ) {}

  use(request: HttpRequestLike, response: HttpResponse, next: (error?: unknown) => void): void {
    const { options } = this;
    const requestId = this.resolveRequestId(request);
    const context = new RequestContext({
      requestId,
      ...serializeRequest(request, {
        includeQuery: options.includeQuery,
        trustProxy: options.trustProxy,
      }),
    });

    response.setHeader(options.requestIdHeader, requestId);

    const timer = new HighResolutionTimer();
    runPluginHook(options.plugins, "before", context.data);

    let finished = false;
    const onDone = () => {
      if (finished) {
        return;
      }
      finished = true;
      this.complete(context, response, timer);
    };

    response.once("finish", onDone);
    response.once("close", onDone);

    contextStorage.run(context, () => next());
  }

  private complete(
    context: RequestContext,
    response: HttpResponse,
    timer: HighResolutionTimer,
  ): void {
    const { options } = this;

    context.set("status", response.statusCode);
    context.set("duration", timer.elapsedRounded());

    runPluginHook(options.plugins, "after", context.data);

    if (!options.logRequests || this.isExcluded(context.get("path"))) {
      return;
    }

    const level = levelForStatus(response.statusCode);
    // Explicit context so the line is correct even outside the async scope.
    const entry = { ...context.data, timestamp: new Date() };

    if (level === "error") {
      options.logger.error("Request failed", getRequestError(context), entry);
    } else {
      options.logger[level]("Request completed", entry);
    }
  }

  private resolveRequestId(request: HttpRequestLike): string {
    const incoming = getHeader(request, this.options.requestIdHeader);

    if (incoming && incoming.length <= MAX_REQUEST_ID_LENGTH && SAFE_REQUEST_ID.test(incoming)) {
      return incoming;
    }

    return generateRequestId();
  }

  private isExcluded(path: unknown): boolean {
    return (
      typeof path === "string" &&
      this.options.excludePaths.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
    );
  }
}
