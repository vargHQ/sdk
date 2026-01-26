# Bug: Grid/Split Clip-Local Overlay Positioning

## Problem

When using `Grid` or `Split` (from `src/react/layouts/`) inside a `<Clip>`, the positioned videos don't fill their allocated space correctly. They appear smaller and misaligned instead of filling the grid cells.

**Screenshot shows**: At 0:04, clip 2 should show two videos split vertically (50% each), but instead they appear small with black gaps.

## Expected vs Actual

**Expected (1080x1920 portrait, vertical split)**:
- Video 1: fills top half (0-960px)
- Video 2: fills bottom half (960-1920px)

**Actual**:
- Videos are scaled with `force_original_aspect_ratio=decrease` (letterboxed)
- They don't fill their allocated grid cells
- Large black gaps between/around videos

## Root Cause

In `src/ai-sdk/providers/editly/index.ts`, the `buildBaseClipFilter` function processes clip-local overlays using `getVideoFilter` with `isOverlay=true`, which applies:

```
scale=${layerWidth}:${layerHeight}:force_original_aspect_ratio=decrease
```

This maintains aspect ratio (letterboxing) instead of filling the cell. Grid videos have `resize: "cover"` set but it's not being respected.

## Relevant Files

1. **`src/ai-sdk/providers/editly/index.ts`** - `buildBaseClipFilter()` function (around line 170-245)
   - This is where clip-local overlays are processed
   - Currently calls `getVideoFilter(layer, ..., true)` which ignores `resizeMode`

2. **`src/ai-sdk/providers/editly/layers.ts`** - `getVideoFilter()` function (around line 83-123)
   - When `isOverlay=true`, it uses `force_original_aspect_ratio=decrease`
   - Doesn't check `layer.resizeMode` for overlays
   - Compare with non-overlay path (line 125+) which DOES check resizeMode

3. **`src/react/layouts/grid.tsx`** - Grid component
   - Sets `resize: "cover"` on children but editly ignores it for overlays

4. **`src/react/layouts/split.tsx`** - Split component (wraps Grid)

## Test File

```bash
bun run test-bug-b.tsx
```

This creates a 3-clip video:
- Clip 1 (0-2s): single video
- Clip 2 (2-4s): vertical split with 2 videos (THIS IS BROKEN)
- Clip 3 (4-6s): single video

## Debug Commands

```bash
# Extract frame at 4 seconds to inspect
ffmpeg -i output/test-bug-b.mp4 -ss 00:00:04 -frames:v 1 output/frame-04.png

# Run with verbose to see ffmpeg filter
bun run test-bug-b.tsx  # already has verbose: true
```

## The Fix

Modify `getVideoFilter` in `layers.ts` to respect `resizeMode` when `isOverlay=true`:

```typescript
if (isOverlay) {
  let scaleFilter = `scale=${layerWidth}:${layerHeight}:force_original_aspect_ratio=decrease`;
  
  // Respect resizeMode for overlay videos (used by Grid/Split)
  if (layer.resizeMode === "cover") {
    const { x, y } = getCropPositionExpr(layer.cropPosition);
    scaleFilter = `scale=${layerWidth}:${layerHeight}:force_original_aspect_ratio=increase,crop=${layerWidth}:${layerHeight}:${x}:${y}`;
  } else if (layer.resizeMode === "stretch") {
    scaleFilter = `scale=${layerWidth}:${layerHeight}`;
  }
  
  filters.push(scaleFilter);
  // ... rest
}
```

This mirrors the logic already present in `getVideoFilterWithTrim` (line 195-203) which correctly handles resizeMode for overlays.

## Verification

After fix:
1. Run `bun run test-bug-b.tsx`
2. Open `output/test-bug-b.mp4`
3. At 0:04, clip 2 should show two videos filling top/bottom halves completely
4. Run `bun test src/ai-sdk/providers/editly/editly.test.ts` to ensure no regressions

## Related Issues

- GitHub Issue #62: Grid/Split inside a Clip causes other clips to not render (partially fixed)
- The clip-local overlay system was added but overlay sizing/resizeMode wasn't implemented
