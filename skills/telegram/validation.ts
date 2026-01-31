/**
 * Input validation helpers for Telegram tool arguments.
 *
 * Ported from src/lib/mcp/validation.ts and src/lib/telegram/args.ts.
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** Validate chat_id or user_id — supports integer IDs, string IDs, and usernames. */
export function validateId(value: unknown, paramName: string): number | string {
  if (typeof value === "number") {
    if (
      !Number.isInteger(value) ||
      value < -(2 ** 63) ||
      value > 2 ** 63 - 1
    ) {
      throw new ValidationError(
        `Invalid ${paramName}: ${value}. ID is out of the valid integer range.`,
      );
    }
    return value;
  }

  if (typeof value === "string") {
    const intValue = Number.parseInt(value, 10);
    if (!Number.isNaN(intValue) && Number.isFinite(intValue)) {
      if (intValue < -(2 ** 63) || intValue > 2 ** 63 - 1) {
        throw new ValidationError(
          `Invalid ${paramName}: ${value}. ID is out of the valid integer range.`,
        );
      }
      return intValue;
    }

    if (/^@?[a-zA-Z0-9_]{5,}$/.test(value)) {
      return value.startsWith("@") ? value : `@${value}`;
    }

    throw new ValidationError(
      `Invalid ${paramName}: '${value}'. Must be a valid integer ID or a username string.`,
    );
  }

  throw new ValidationError(
    `Invalid ${paramName}: ${String(value)}. Type must be an integer or a string.`,
  );
}

/** Validate a positive integer parameter. */
export function validatePositiveInt(
  value: unknown,
  paramName: string,
): number {
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value <= 0) {
      throw new ValidationError(
        `Invalid ${paramName}: ${value}. Must be a positive integer.`,
      );
    }
    return value;
  }

  if (typeof value === "string") {
    const intValue = Number.parseInt(value, 10);
    if (Number.isNaN(intValue) || intValue <= 0) {
      throw new ValidationError(
        `Invalid ${paramName}: '${value}'. Must be a positive integer.`,
      );
    }
    return intValue;
  }

  throw new ValidationError(
    `Invalid ${paramName}: ${String(value)}. Must be a positive integer.`,
  );
}

/** Validate optional ID (can be undefined). */
export function validateOptionalId(
  value: unknown,
  paramName: string,
): number | string | undefined {
  if (value === undefined || value === null) return undefined;
  return validateId(value, paramName);
}

/** Read an optional number from args with a fallback. */
export function optNumber(
  args: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const v = args[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/** Read an optional string from args. */
export function optString(
  args: Record<string, unknown>,
  key: string,
): string | undefined {
  const v = args[key];
  return typeof v === "string" ? v : undefined;
}

/** Read a required string from args. */
export function reqString(
  args: Record<string, unknown>,
  key: string,
): string {
  const v = args[key];
  if (typeof v !== "string" || !v) {
    throw new ValidationError(`Missing required parameter: ${key}`);
  }
  return v;
}

/** Read an optional boolean from args. */
export function optBoolean(
  args: Record<string, unknown>,
  key: string,
  fallback = false,
): boolean {
  const v = args[key];
  return typeof v === "boolean" ? v : fallback;
}
