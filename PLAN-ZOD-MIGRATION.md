# Zod Migration Plan

Migrate from custom JSON Schema-style definitions to Zod for type-safe validation.

## Overview

**Goal**: Replace manual schema definitions and custom validator with Zod schemas that provide:
- Automatic TypeScript type inference
- Built-in validation with detailed errors
- Cleaner action/model definitions

## Files to Change

### Phase 1: Setup & Core

| File | Action | Description |
|------|--------|-------------|
| `package.json` | Modify | Add `zod` dependency |
| `src/core/schema/types.ts` | Modify | Update types to support Zod schemas |
| `src/core/schema/validator.ts` | Modify | Replace custom validation with Zod |
| `src/core/schema/index.ts` | Modify | Export Zod helpers |

### Phase 2: Model Definitions

| File | Action | Description |
|------|--------|-------------|
| `src/definitions/models/flux.ts` | Modify | Convert to Zod schema |
| `src/definitions/models/kling.ts` | Modify | Convert to Zod schema |
| `src/definitions/models/wan.ts` | Modify | Convert to Zod schema |
| `src/definitions/models/soul.ts` | Modify | Convert to Zod schema |
| `src/definitions/models/elevenlabs.ts` | Modify | Convert to Zod schema |
| `src/definitions/models/whisper.ts` | Modify | Convert to Zod schema |
| `src/definitions/models/llama.ts` | Modify | Convert to Zod schema |
| `src/definitions/models/sonauto.ts` | Modify | Convert to Zod schema |

### Phase 3: Action Definitions

| File | Action | Description |
|------|--------|-------------|
| `src/definitions/actions/image.ts` | Modify | Convert to Zod schema |
| `src/definitions/actions/video.ts` | Modify | Convert to Zod schema |
| `src/definitions/actions/voice.ts` | Modify | Convert to Zod schema |
| `src/definitions/actions/music.ts` | Modify | Convert to Zod schema |
| `src/definitions/actions/transcribe.ts` | Modify | Convert to Zod schema |
| `src/definitions/actions/sync.ts` | Modify | Convert to Zod schema |
| `src/definitions/actions/captions.ts` | Modify | Convert to Zod schema |
| `src/definitions/actions/edit.ts` | Modify | Convert to Zod schemas (7 actions) |

### Phase 4: Skill Definitions

| File | Action | Description |
|------|--------|-------------|
| `src/definitions/skills/talking-character.ts` | Modify | Convert to Zod schema |
| `src/definitions/skills/text-to-tiktok.ts` | Modify | Convert to Zod schema |

### Phase 5: Executor & CLI Updates

| File | Action | Description |
|------|--------|-------------|
| `src/core/executor/executor.ts` | Modify | Use Zod validation |
| `src/cli/commands/run.ts` | Modify | Update schema display for --info |
| `src/cli/commands/which.ts` | Modify | Update schema display |
| `src/utils/formatters.ts` | Modify | Update `formatSchemaInputs` for Zod |

## Detailed Changes

### 1. New Schema Structure

**Before (JSON Schema style):**
```typescript
export const definition: ActionDefinition = {
  type: "action",
  name: "video",
  schema: {
    input: {
      type: "object",
      required: ["prompt"],
      properties: {
        prompt: { type: "string", description: "What to generate" },
        duration: { type: "integer", enum: [5, 10], default: 5 },
      },
    },
    output: { type: "string", format: "url" },
  },
  execute: async (inputs) => {
    const { prompt, duration } = inputs as { prompt: string; duration?: number };
    // ...
  },
};
```

**After (Zod):**
```typescript
import { z } from "zod";

export const videoInputSchema = z.object({
  prompt: z.string().describe("What to generate"),
  duration: z.number().int().refine(v => [5, 10].includes(v)).default(5).describe("Duration"),
  image: z.string().optional().describe("Input image path or URL"),
});

export const videoOutputSchema = z.string().url();

export type VideoInput = z.infer<typeof videoInputSchema>;
export type VideoOutput = z.infer<typeof videoOutputSchema>;

export const definition: ActionDefinition = {
  type: "action",
  name: "video",
  description: "Generate video from text or image",
  inputSchema: videoInputSchema,
  outputSchema: videoOutputSchema,
  execute: async (inputs) => {
    // inputs is already typed as VideoInput!
    const { prompt, duration, image } = inputs;
    // ...
  },
};
```

### 2. Updated Types (src/core/schema/types.ts)

```typescript
import { z } from "zod";

export interface BaseDefinition {
  type: "model" | "action" | "skill";
  name: string;
  description: string;
  inputSchema: z.ZodType;
  outputSchema: z.ZodType;
}

export interface ActionDefinition extends BaseDefinition {
  type: "action";
  routes: ActionRoute[];
  execute?: <T>(inputs: T) => Promise<unknown>;
}
```

### 3. Simplified Validator (src/core/schema/validator.ts)

```typescript
import { z } from "zod";

export function validate<T extends z.ZodType>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}
```

### 4. CLI Schema Display Helper

```typescript
// Convert Zod schema to displayable format for --info
export function zodSchemaToDisplay(schema: z.ZodObject<any>) {
  const shape = schema.shape;
  return Object.entries(shape).map(([key, value]) => ({
    name: key,
    type: getZodType(value),
    required: !value.isOptional(),
    description: value.description,
    default: getZodDefault(value),
  }));
}
```

## Migration Order

1. **Install Zod** - `bun add zod`
2. **Update core types** - Make schema property accept Zod
3. **Update validator** - Use Zod's safeParse
4. **Migrate one action** - Start with `video.ts` as test
5. **Run tests** - Verify it works
6. **Migrate remaining definitions** - One by one
7. **Update CLI** - Schema display helpers
8. **Cleanup** - Remove old JSON schema code

## Rollback Plan

Keep old `schema` property as optional during migration. Both can coexist:

```typescript
export interface ActionDefinition {
  // New (Zod)
  inputSchema?: z.ZodType;
  outputSchema?: z.ZodType;
  // Old (JSON Schema) - deprecated
  schema?: { input: {...}, output: {...} };
}
```

## Estimated Changes

- **Files modified**: ~25
- **New dependencies**: 1 (zod)
- **Breaking changes**: Internal only (execute function signature)
