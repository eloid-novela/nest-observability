import type { HttpResponseLike } from "../http/types.js";
import type { LogContext, LogLevel } from "../interfaces/index.js";

export function serializeResponse(response: HttpResponseLike): LogContext {
  return response.statusCode === undefined ? {} : { status: response.statusCode };
}

/** 5xx → error, 4xx → warn, everything else → info. */
export function levelForStatus(status: number | undefined): LogLevel {
  if (status !== undefined && status >= 500) {
    return "error";
  }

  if (status !== undefined && status >= 400) {
    return "warn";
  }

  return "info";
}
