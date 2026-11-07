import type { LogContext } from "../interfaces/index.js";

/** Mutable bag of fields that belongs to a single request. */
export class RequestContext {
  private readonly context: LogContext;

  constructor(context: LogContext = {}) {
    // Copy so later `set` calls never mutate the caller's object.
    this.context = { ...context };
  }

  get data(): Readonly<LogContext> {
    return this.context;
  }

  get requestId(): string | undefined {
    return this.context.requestId;
  }

  set<K extends keyof LogContext>(key: K, value: LogContext[K]): void {
    this.context[key] = value;
  }

  get<K extends keyof LogContext>(key: K): LogContext[K] {
    return this.context[key];
  }

  merge(values: LogContext): void {
    Object.assign(this.context, values);
  }
}
