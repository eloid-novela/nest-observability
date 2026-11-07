import { Catch, Inject, type ArgumentsHost } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import { contextStorage } from "@nestjs-observability/core";
import { throwError, type Observable } from "rxjs";
import { OBSERVABILITY_OPTIONS } from "./constants.js";
import type { ResolvedObservabilityOptions } from "./options.js";
import { recordRequestError } from "./request-errors.js";

interface NestRpcOrWsException {
  getError(): unknown;
}

/**
 * Catch-all filter that records the exception on the request context — including
 * exceptions thrown by guards, pipes and middleware, which interceptors never see —
 * and then responds exactly like Nest's built-in handlers.
 *
 * Your own filters still take precedence for the exceptions they catch.
 */
@Catch()
export class ObservabilityExceptionFilter extends BaseExceptionFilter {
  constructor(
    @Inject(OBSERVABILITY_OPTIONS)
    private readonly options: ResolvedObservabilityOptions,
  ) {
    super();
  }

  override catch(exception: unknown, host: ArgumentsHost): void | Observable<never> {
    const requestContext = contextStorage.get();
    if (requestContext) {
      recordRequestError(requestContext, exception, this.options.plugins);
    }

    switch (host.getType<string>()) {
      case "rpc":
        return this.handleRpc(exception);
      case "ws":
        return this.handleWs(exception, host);
      default:
        return super.catch(exception, host);
    }
  }

  /** Same behaviour as Nest's BaseRpcExceptionFilter. */
  private handleRpc(exception: unknown): Observable<never> {
    if (isRpcOrWsException(exception)) {
      const error = exception.getError();
      const payload = typeof error === "object" && error !== null ? error : { status: "error", message: error };
      return throwError(() => payload);
    }

    return throwError(() => ({ status: "error", message: "Internal server error" }));
  }

  /** Same behaviour as Nest's BaseWsExceptionFilter. */
  private handleWs(exception: unknown, host: ArgumentsHost): void {
    const client = host.switchToWs().getClient<{ emit?: (event: string, payload: unknown) => void }>();
    let payload: unknown = { status: "error", message: "Internal server error" };

    if (isRpcOrWsException(exception)) {
      const error = exception.getError();
      payload = typeof error === "object" && error !== null ? error : { status: "error", message: error };
    }

    client?.emit?.("exception", payload);
  }
}

function isRpcOrWsException(value: unknown): value is NestRpcOrWsException {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Partial<NestRpcOrWsException>).getError === "function"
  );
}
