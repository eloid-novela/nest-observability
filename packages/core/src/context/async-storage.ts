import {
  AsyncLocalStorage,
} from "node:async_hooks";

import {
  RequestContext,
} from "./request-context.js";


class ContextStorage {

  private storage =
    new AsyncLocalStorage<RequestContext>();


  run(
    context: RequestContext,
    callback: () => void,
  ) {

    this.storage.run(
      context,
      callback,
    );

  }


  get():
    RequestContext | undefined {

    return this.storage.getStore();

  }

}


export const contextStorage =
  new ContextStorage();