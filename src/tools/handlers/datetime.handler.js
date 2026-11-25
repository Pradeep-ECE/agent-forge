import { z } from "zod";

const datetimeInputSchema = z
  .object({
    timezone: z
      .string()
      .trim()
      .min(1, "Timezone cannot be empty")
      .max(100, "Timezone exceeds maximum length")
      .optional()
      .default("UTC"),
  })
  .strict();

/**
 * Validates whether a string is a valid IANA timezone identifier.
 */
function assertValidTimezone(timezone) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
  } catch {
    throw new Error(`TOOL_VALIDATION_ERROR: Invalid IANA timezone '${timezone}'`);
  }
}

/**
 * Safe current date/time tool handler.
 */
export async function executeGetCurrentDatetime(rawArgs = {}) {
  const parsed = datetimeInputSchema.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    throw new Error(
      `TOOL_VALIDATION_ERROR: ${parsed.error.issues[0]?.message || "Invalid input"}`
    );
  }

  const { timezone } = parsed.data;
  assertValidTimezone(timezone);

  const now = new Date();

  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "long",
    timeZoneName: "short",
  }).format(now);

  return {
    timezone,
    isoUtc: now.toISOString(),
    formatted,
  };
}