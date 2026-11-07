import { runPluginHook, type LoggerPlugin, type RequestContext } from "@nestjs-observability/core";

// Kept outside the context data so the raw exception never leaks into log fields.
const requestErrors = new WeakMap<RequestContext, unknown>();

/**
 * Records the error thrown while handling the request owning `context` and runs
 * the plugins' `error` hook. Only the first error is kept: the interceptor and
 * the exception filter may both see the same exception.
 */
export function recordRequestError(
  context: RequestContext,
  error: unknown,
  plugins: readonly LoggerPlugin[],
): void {
  if (requestErrors.has(context)) {
    return;
  }

  requestErrors.set(context, error);
  runPluginHook(plugins, "error", error, context.data);
}

export function getRequestError(context: RequestContext): unknown {
  return requestErrors.get(context);
}
