import { safeStringify } from "../utils/safe-stringify.js";
import { BaseFormatter } from "./formatter.js";

/** One JSON object per line; safe against circular references and bigints. */
export class JsonFormatter extends BaseFormatter {
  format(entry: Readonly<Record<string, unknown>>): string {
    return safeStringify({
      ...entry,
      timestamp: normalizeTimestamp(entry.timestamp),
    });
  }
}

export function normalizeTimestamp(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string" && value !== "") {
    return value;
  }

  return new Date().toISOString();
}
