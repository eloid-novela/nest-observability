import {
  BaseFormatter,
} from "./formatter.js";

export class PrettyFormatter extends BaseFormatter {
  format(context: Readonly<Record<string, unknown>>): string {
    const duration = context.duration;
    const error = context.error;
    const errorMessage =
      typeof error === "object" && error !== null && "message" in error
        ? String(error.message)
        : error;
    const parts = [
      context.timestamp,
      typeof context.level === "string" ? context.level.toUpperCase() : undefined,
      context.message,
      context.requestId,
      context.method,
      context.path,
      context.status,
      duration === undefined || duration === null ? undefined : `${duration}ms`,
      context.ip,
      errorMessage,
    ];

    return parts
      .filter((part) => part !== undefined && part !== null && part !== "")
      .map(String)
      .join(" ");
  }
}