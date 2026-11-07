import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { LogContext } from "../interfaces/index.js";
import { RequestContext } from "./request-context.js";

/** Propagates a RequestContext through every async call made while handling a request. */
export class ContextStorage {
  private readonly storage = new AsyncLocalStorage<RequestContext>();

  run<T>(context: RequestContext | LogContext, callback: () => T): T {
    const requestContext =
      context instanceof RequestContext ? context : new RequestContext(context);

    return this.storage.run(requestContext, callback);
  }

  get(): RequestContext | undefined {
    return this.storage.getStore();
  }
}

const GLOBAL_KEY = Symbol.for("@nestjs-observability/core:contextStorage");
const globalStore = globalThis as { [GLOBAL_KEY]?: ContextStorage };

/**
 * Process-wide singleton. Stored on `globalThis` so the ESM and CommonJS builds
 * (or two installed copies of this package) share the same request context.
 */
export const contextStorage: ContextStorage = (globalStore[GLOBAL_KEY] ??= new ContextStorage());

export function generateRequestId(): string {
  return randomUUID();
}
