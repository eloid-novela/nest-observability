import type { LogContext } from "../interfaces/index.js";

/**
 * Hooks into the lifecycle of a request. Hooks receive the live request
 * context, so they can enrich it (e.g. add a user id or tenant) before the
 * completion log is written. A throwing plugin never breaks the request.
 */
export interface LoggerPlugin {
  /** Called when the request starts, before the handler runs. */
  before?(context: LogContext): void;

  /** Called when the response has been sent, before the completion log. */
  after?(context: LogContext): void;

  /** Called when the handler throws. */
  error?(error: unknown, context: LogContext): void;
}

export function runPluginHook<K extends keyof LoggerPlugin>(
  plugins: readonly LoggerPlugin[],
  hook: K,
  ...args: Parameters<NonNullable<LoggerPlugin[K]>>
): void {
  for (const plugin of plugins) {
    try {
      (plugin[hook] as ((...a: unknown[]) => void) | undefined)?.apply(plugin, args);
    } catch {
      // Plugins are best-effort: observability must never break the request.
    }
  }
}
