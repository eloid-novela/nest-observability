export const REDACTED = "[REDACTED]";

/** Keys redacted by default, compared case-insensitively. */
export const DEFAULT_REDACT_KEYS: readonly string[] = [
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "password",
  "passwd",
  "secret",
  "token",
  "accessToken",
  "refreshToken",
  "idToken",
  "apiKey",
  "api_key",
  "x-api-key",
  "clientSecret",
  "privateKey",
  "creditCard",
  "cardNumber",
  "cvv",
];

const MAX_DEPTH = 10;

/**
 * Returns a deep copy of `value` where every property whose key matches one of
 * `keys` (case-insensitive) is replaced by "[REDACTED]". The input is never mutated.
 */
export function redact<T>(value: T, keys: readonly string[]): T {
  if (keys.length === 0) {
    return value;
  }

  const lowerKeys = new Set(keys.map((key) => key.toLowerCase()));
  return visit(value, lowerKeys, new WeakSet(), 0) as T;
}

function visit(value: unknown, keys: Set<string>, seen: WeakSet<object>, depth: number): unknown {
  if (typeof value !== "object" || value === null || depth > MAX_DEPTH) {
    return value;
  }

  // Leave errors, dates and other class instances alone: they are serialized later.
  if (!Array.isArray(value) && !isPlainObject(value)) {
    return value;
  }

  if (seen.has(value)) {
    return value;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => visit(item, keys, seen, depth + 1));
  }

  const copy: Record<string, unknown> = {};
  for (const [key, current] of Object.entries(value)) {
    copy[key] = keys.has(key.toLowerCase()) ? REDACTED : visit(current, keys, seen, depth + 1);
  }

  return copy;
}

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
