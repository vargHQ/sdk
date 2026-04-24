/**
 * Per-model provider input validation schemas.
 *
 * Each model that has provider-specific input constraints (duration format,
 * allowed ranges, type coercion) gets a Zod schema here. The schemas use
 * `.transform()` to auto-fix invalid inputs — rounding floats, clamping to
 * valid ranges, and converting types (e.g. number → string for Kling v3).
 *
 * Usage:
 *   const fixed = normalizeProviderInput("kling-v3", { duration: 2.34 });
 *   // → { duration: "3" }  (rounded to 2, clamped to min 3, stringified)
 *
 * NOTE: This file is kept in sync with gateway/packages/schemas/src/model-rules.ts.
 *       When adding new model rules, update both files.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Duration schema builders
// ---------------------------------------------------------------------------

/** Duration as string integer clamped to [min, max]. Accepts number, outputs string. */
function stringIntDuration(min: number, max: number, defaultVal: number) {
  return z
    .number()
    .optional()
    .transform((v) =>
      String(Math.max(min, Math.min(max, Math.round(v ?? defaultVal)))),
    );
}

/** Duration snapped to nearest allowed value. Accepts number, outputs number. */
function enumDuration(allowed: number[], defaultVal: number) {
  return z
    .number()
    .optional()
    .transform((v) => {
      const raw = v ?? defaultVal;
      return allowed.reduce((prev, curr) =>
        Math.abs(curr - raw) < Math.abs(prev - raw) ? curr : prev,
      );
    });
}

/** Duration as integer clamped to [min, max]. Accepts number, outputs number. */
function rangeDuration(min: number, max: number, defaultVal: number) {
  return z
    .number()
    .optional()
    .transform((v) =>
      Math.max(min, Math.min(max, Math.round(v ?? defaultVal))),
    );
}

/** Passthrough duration rounded to integer. */
function intDuration(defaultVal: number) {
  return z
    .number()
    .optional()
    .transform((v) => Math.round(v ?? defaultVal));
}

// ---------------------------------------------------------------------------
// Per-model provider input schemas
// ---------------------------------------------------------------------------

const ModelDurationRules: Record<string, z.ZodType> = {
  // Kling O3 (v3): fal expects string integer "3"–"15"
  "kling-v3": z.object({ duration: stringIntDuration(3, 15, 5) }),
  "kling-v3-standard": z.object({ duration: stringIntDuration(3, 15, 5) }),

  // Kling O3 4K: same rules as v3
  "kling-v3-4k-image-to-video": z.object({
    duration: stringIntDuration(3, 15, 5),
  }),

  // Kling O3 reference-to-video: same duration range
  "kling-v3-pro-reference-to-video": z.object({
    duration: stringIntDuration(3, 15, 5),
  }),
  "kling-v3-4k-reference-to-video": z.object({
    duration: stringIntDuration(3, 15, 5),
  }),

  // Kling O3 video-to-video reference: same duration range
  "kling-v3-standard-v2v-reference": z.object({
    duration: stringIntDuration(3, 15, 5),
  }),

  // Kling v2.6: same rules as v3
  "kling-v2.6": z.object({ duration: stringIntDuration(3, 15, 5) }),

  // Kling legacy: exactly 5 or 10
  "kling-v2.5": z.object({ duration: enumDuration([5, 10], 5) }),
  "kling-v2.1": z.object({ duration: enumDuration([5, 10], 5) }),
  "kling-v2": z.object({ duration: enumDuration([5, 10], 5) }),

  // Wan: 5 or 10
  "wan-2.5": z.object({ duration: enumDuration([5, 10], 5) }),
  "wan-2.5-preview": z.object({ duration: enumDuration([5, 10], 5) }),

  // Minimax: round to integer
  minimax: z.object({ duration: intDuration(5) }),

  // Grok Imagine: integer 1–15
  "grok-imagine": z.object({ duration: rangeDuration(1, 15, 6) }),

  // Sora 2: only 4, 8, 12, 16, 20
  "sora-2": z.object({ duration: enumDuration([4, 8, 12, 16, 20], 4) }),
  "sora-2-pro": z.object({ duration: enumDuration([4, 8, 12, 16, 20], 4) }),

  // Seedance (piapi): 5, 10, or 15
  "seedance-2-preview": z.object({ duration: enumDuration([5, 10, 15], 5) }),
  "seedance-2-fast-preview": z.object({
    duration: enumDuration([5, 10, 15], 5),
  }),
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Normalize provider input for a given model.
 *
 * Validates and transforms fields (currently `duration`) to match what the
 * provider API expects — correct type, clamped to valid range, rounded to
 * integer.
 *
 * - Unknown models: input returned as-is (passthrough).
 * - Parse failures: input returned as-is (defensive — never throws).
 */
export function normalizeProviderInput(
  model: string,
  input: Record<string, unknown>,
): Record<string, unknown> {
  const schema = ModelDurationRules[model];
  if (!schema) return input;

  const result = schema.safeParse({ duration: input.duration });
  if (!result.success) return input;

  return { ...input, ...(result.data as Record<string, unknown>) };
}

export { ModelDurationRules };
