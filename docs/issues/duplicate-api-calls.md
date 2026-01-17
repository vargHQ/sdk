# React renderer: duplicate API calls for shared image elements

## Problem

When multiple clips use the same base image element (through a dependency chain), the renderer makes duplicate API calls instead of reusing the result.

### Example

```tsx
const baseCharacter = Image({ prompt: '...', model: higgsfield.imageModel('soul') });
const recoloredCharacter = Image({ prompt: { images: [baseCharacter] }, model: fal.imageModel('nano-banana') });

const angleLeft = Image({ prompt: { images: [recoloredCharacter] }, ... });
const angleRight = Image({ prompt: { images: [recoloredCharacter] }, ... });

<Render>
  <Clip><Video prompt={{ images: [angleLeft] }} /></Clip>
  <Clip><Video prompt={{ images: [angleRight] }} /></Clip>
</Render>
```

### Current behavior

```
⏳ generating image with soul (~30s)
⏳ generating image with soul (~30s)   <-- duplicate!
```

Both clips are rendered in parallel via `Promise.all`, and each independently resolves the `baseCharacter` dependency before the cache is populated.

### Root cause

In `src/ai-sdk/react/renderers/render.ts:150-152`:

```typescript
const renderedClips = await Promise.all(
  clipElements.map((clipElement) => renderClip(clipElement, ctx)),
);
```

### Proposed solution

Add in-memory promise deduplication in `RenderContext`:

1. Add `pendingImages: Map<string, Promise<string>>` to context
2. In `renderImage`, before making API call:
   - Compute cache key
   - Check if promise already exists in map
   - If yes, await existing promise
   - If no, create promise, store in map, then await

This ensures that concurrent renders of the same element share a single API call.

### Files to modify

- `src/ai-sdk/react/renderers/context.ts` - add pendingImages/pendingVideos maps
- `src/ai-sdk/react/renderers/render.ts` - initialize maps
- `src/ai-sdk/react/renderers/image.ts` - use deduplication
- `src/ai-sdk/react/renderers/video.ts` - use deduplication
