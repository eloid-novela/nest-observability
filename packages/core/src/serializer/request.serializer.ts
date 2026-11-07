import type { HeaderValue, HttpRequestLike } from "../http/types.js";
import type { LogContext } from "../interfaces/index.js";

export interface RequestSerializerOptions {
  /** Include the query string in `path`. Defaults to false (avoids logging tokens). */
  includeQuery?: boolean;
  /** Trust the first `x-forwarded-for` address when the framework didn't resolve `ip`. */
  trustProxy?: boolean;
}

export function serializeRequest(
  request: HttpRequestLike,
  options: RequestSerializerOptions = {},
): LogContext {
  const rawUrl = request.originalUrl ?? request.url ?? "";
  const path = options.includeQuery ? rawUrl : rawUrl.split("?")[0];

  return removeUndefined({
    transport: "http",
    method: request.method,
    path: path || undefined,
    ip: resolveIp(request, options.trustProxy ?? false),
    userAgent: firstHeader(request.headers?.["user-agent"]),
  });
}

export function getHeader(request: HttpRequestLike, name: string): string | undefined {
  return firstHeader(request.headers?.[name.toLowerCase()]);
}

function resolveIp(request: HttpRequestLike, trustProxy: boolean): string | undefined {
  if (request.ip) {
    return request.ip;
  }

  if (trustProxy) {
    const forwarded = getHeader(request, "x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) {
      return forwarded;
    }
  }

  return request.socket?.remoteAddress ?? undefined;
}

function firstHeader(value: HeaderValue): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value === undefined ? undefined : String(value);
}

function removeUndefined<T extends Record<string, unknown>>(value: T): T {
  for (const key of Object.keys(value)) {
    if (value[key] === undefined) {
      delete value[key];
    }
  }

  return value;
}
