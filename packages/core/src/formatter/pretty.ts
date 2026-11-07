import { BaseFormatter } from "./formatter.js";
import { normalizeTimestamp } from "./json.js";

/** Single-line, human-readable output for local development. */
export class PrettyFormatter extends BaseFormatter {
  format(entry: Readonly<Record<string, unknown>>): string {
    const { duration, error } = entry;
    const errorMessage =
      typeof error === "object" && error !== null && "message" in error
        ? String(error.message)
        : error;

    const parts = [
      normalizeTimestamp(entry.timestamp),
      typeof entry.level === "string" ? entry.level.toUpperCase() : undefined,
      typeof entry.context === "string" ? `[${entry.context}]` : undefined,
      entry.message,
      entry.requestId,
      entry.method,
      entry.path,
      entry.status,
      duration === undefined || duration === null ? undefined : `${duration}ms`,
      entry.ip,
      errorMessage,
    ];

    return parts
      .filter((part) => part !== undefined && part !== null && part !== "")
      .map(String)
      .join(" ");
  }
}
