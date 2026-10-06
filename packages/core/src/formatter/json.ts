import {
 BaseFormatter,
} from "./formatter.js";

export class JsonFormatter extends BaseFormatter {
 format(context: Readonly<Record<string, unknown>>): string {
   return JSON.stringify({
     ...context,
     timestamp: context.timestamp ?? new Date().toISOString(),
   });
 }
}