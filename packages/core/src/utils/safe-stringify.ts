/**
 * JSON.stringify that never throws: circular references become "[Circular]",
 * bigints become strings and errors keep their name, message and stack.
 */
export function safeStringify(value: unknown): string {
  const ancestors: unknown[] = [];

  return JSON.stringify(value, function (this: unknown, _key, current: unknown) {
    if (typeof current === "bigint") {
      return current.toString();
    }

    if (current instanceof Error) {
      return { name: current.name, message: current.message, stack: current.stack };
    }

    if (typeof current !== "object" || current === null) {
      return current;
    }

    // `this` is the object holding the current key: drop ancestors we've left.
    while (ancestors.length > 0 && ancestors[ancestors.length - 1] !== this) {
      ancestors.pop();
    }

    if (ancestors.includes(current)) {
      return "[Circular]";
    }

    ancestors.push(current);
    return current;
  });
}
