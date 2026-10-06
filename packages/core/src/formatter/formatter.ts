import type {
  Formatter,
} from "../interfaces/index.js";

export abstract class BaseFormatter implements Formatter {
  abstract format(context: Readonly<Record<string, unknown>>): string;
}