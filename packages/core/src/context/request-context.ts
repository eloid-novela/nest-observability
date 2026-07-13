import {
  LogContext,
} from "../interfaces";


export class RequestContext {

  private context: LogContext;


  constructor(
    context: LogContext,
  ) {
    this.context = context;
  }


  get data(): LogContext {
    return this.context;
  }


  set<K extends keyof LogContext>(
    key: K,
    value: LogContext[K],
  ): void {
    this.context[key] = value;
  }


  get(
    key: keyof LogContext,
  ) {
    return this.context[key];
  }

}
