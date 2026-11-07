import type { SerializedError } from "../interfaces/index.js";

const MAX_CAUSE_DEPTH = 5;

/** Converts any thrown value into a plain, JSON-safe object. */
export function serializeError(value: unknown, depth = 0): SerializedError {
  if (!(value instanceof Error)) {
    return {
      name: "NonError",
      message: typeof value === "string" ? value : safeToString(value),
    };
  }

  const serialized: SerializedError = {
    name: value.name,
    message: value.message,
  };

  if (value.stack) {
    serialized.stack = value.stack;
  }

  const code = (value as { code?: unknown }).code;
  if (code !== undefined) {
    serialized.code = code;
  }

  if (value.cause !== undefined && depth < MAX_CAUSE_DEPTH) {
    serialized.cause = serializeError(value.cause, depth + 1);
  }

  return serialized;
}

function safeToString(value: unknown): string {
  try {
    return typeof value === "object" ? JSON.stringify(value) : String(value);
  } catch {
    return String(value);
  }
}
