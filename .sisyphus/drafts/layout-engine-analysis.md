# Layout Engine Analysis: Native vs Userland vs Yoga

## Executive Summary

Three approaches to implement split/grid layouts in varg SDK:

| Approach | Status | Bugs | Complexity | Recommendation |
|----------|--------|------|------------|----------------|
| **Native Split** | Working | None known | High (editly call per split) | ❌ Remove |
| **Userland Grid/Split** | Buggy (main) | #61, #62 fixed in unmerged commit | Low (prop injection) | ✅ Merge fix, keep |
| **Yoga Layout** | Research | N/A | Medium (new dependency) | 🤔 Future consideration |

---

## 1. Native Split (`src/react/renderers/split.ts`)

### How it works
```
JSX <Split> → collect children → calculate positions → call editly() → temp video → return path
```

1. Iterates through children (Image/Video only)
2. Calculates cell dimensions based on direction and child count
3. Creates editly Layer[] with position/size
4. Calls `editly()` to render a temp video (`.mp4`)
5. Returns the temp file path

### Pros
- Self-contained rendering - no dependency on parent clip
- Works with any editly-supported layer types
- No bugs related to overlay deduplication

### Cons
- **Performance**: Creates a full video file per split (FFmpeg encode + decode)
- **Nested splits**: Each level = another video encode
- **Limited to 2 children**: `left` + `right` only
- **No transitions**: Can't have transitions between split children
- **Audio handling**: Loses audio from video children

### Code Assessment
```typescript
// Creates temporary video for every split
const outPath = `/tmp/varg-split-${Date.now()}.mp4`;
await editly({
  outPath,
  width: ctx.width,
  height: ctx.height,
  fps: ctx.fps,
  clips: [clip],  // Single clip with positioned layers
});
```

---

## 2. Userland Grid/Split (`src/react/layouts/grid.tsx`, `split.tsx`)

### How it works
```
JSX <Grid> → calculate positions → inject props → return children → clip renderer handles positioning
```

1. Grid calculates percentage-based positions: `left: "50%"`, `top: "0%"`, etc.
2. Injects position props into children
3. Returns modified children (JSX fragment)
4. Clip renderer converts percentage to pixels via `parseSize()`

### Pros
- **Zero overhead**: Just prop injection, no video encoding
- **Composable**: Works with any number of children
- **Flexible**: Grid supports N×M layouts, Split is a convenience wrapper
- **Audio preserved**: Video children keep their audio

### Cons
- **Known bugs** (in main branch):
  - Issue #61: Same video in multiple positions → only one renders (Map key collision)
  - Issue #62: Grid inside clip causes other clips to disappear (overlay span bug)
- **Fix exists but unmerged**: Commit `412100a` fixes both issues

### Bug Status

**Issue #61 - Same Video Deduplication**
```typescript
// BUGGY (main branch):
overlays.set(videoLayer.path, { layer, totalDuration });  // path as key

// FIXED (commit 412100a):
const key = `${path}:${left}:${top}:${width}:${height}`;  // composite key
overlays.set(key, { layer, totalDuration });
```

**Issue #62 - Clip-Local vs Continuous Overlays**
```typescript
// BUGGY (main branch):
// All positioned videos collected as "continuous overlays" that span entire video

// FIXED (commit 412100a):
function isClipLocalVideoOverlay(layer): boolean {
  // Has position but NO cutFrom/cutTo → local to clip
  return v.cutFrom === undefined && v.cutTo === undefined;
}
function isContinuousVideoOverlay(layer): boolean {
  // Has position AND cutFrom/cutTo → spans multiple clips
  return v.cutFrom !== undefined || v.cutTo !== undefined;
}
```

### Fix Commit Details
- **Commit**: `412100a`
- **Status**: Exists in branches `feat/rendi`, `feat/slot-element`, etc. but NOT merged to main
- **Changes**: 73 additions, 16 deletions in `src/ai-sdk/providers/editly/index.ts`

---

## 3. Yoga Layout (Research)

### What is Yoga
- Cross-platform flexbox layout engine by Meta (used in React Native)
- C++ core with WebAssembly bindings for JS/TS
- Implements CSS flexbox spec without a browser

### Installation
```bash
bun install yoga-layout
```

### Basic Usage
```typescript
import Yoga, { FlexDirection, Direction, Edge } from 'yoga-layout';

const root = Yoga.Node.create();
root.setWidth(1920);
root.setHeight(1080);
root.setFlexDirection(FlexDirection.Row);

const left = Yoga.Node.create();
left.setWidth("50%");
left.setHeight("100%");
root.insertChild(left, 0);

const right = Yoga.Node.create();
right.setWidth("50%");
right.setHeight("100%");
root.insertChild(right, 1);

root.calculateLayout(undefined, undefined, Direction.LTR);

// Get computed positions
console.log(left.getComputedLeft(), left.getComputedWidth());

// CRITICAL: Must free nodes manually
root.freeRecursive();
```

### Pros
- **Battle-tested**: Powers React Native layouts for millions of apps
- **Full flexbox**: flex-grow, flex-shrink, flex-wrap, gaps, padding, margins
- **Percentage support**: Native `%` values
- **Fast**: C++ WASM, handles thousands of nodes in milliseconds
- **Future-proof**: Could support more complex layouts (masonry, overlapping)

### Cons
- **New dependency**: ~200KB WASM bundle
- **No CSS Grid**: Flexbox only (but flex-wrap can simulate grids)
- **Manual memory**: Must call `node.free()` or `node.freeRecursive()`
- **Overkill for simple splits**: Grid.tsx is 29 lines; Yoga wrapper would be ~100+

### When Yoga Makes Sense
- Complex nested layouts with flex-grow/shrink
- Responsive layouts with min/max constraints
- Absolute positioning with anchoring
- If Grid bugs become hard to maintain

---

## Comparison Matrix

| Feature | Native Split | Userland Grid | Yoga |
|---------|--------------|---------------|------|
| **Performance** | ❌ FFmpeg per split | ✅ Zero overhead | ✅ Fast WASM |
| **Children count** | 2 (left/right) | N (any) | N (any) |
| **Audio handling** | ❌ Lost | ✅ Preserved | ✅ Preserved |
| **Transitions** | ❌ None | ✅ Inherited | ✅ Inherited |
| **Complexity** | High (editly) | Low (props) | Medium (API) |
| **Dependencies** | None new | None new | +yoga-layout |
| **Current bugs** | None | #61, #62 (fixed) | N/A |
| **Grid support** | ❌ No | ✅ Yes | ✅ Yes (flex-wrap) |
| **Bundle size** | 0 | 0 | +~200KB |

---

## Recommendations

### Option A: Keep Userland, Merge Fix (RECOMMENDED)
1. Merge commit `412100a` to main (fixes #61, #62)
2. Remove native Split renderer (`src/react/renderers/split.ts`)
3. Keep userland Grid/Split/Slot as the only layout system

**Why**: Simplest, already working, just needs the fix merged.

### Option B: Replace with Yoga
1. Add `yoga-layout` dependency
2. Create `src/react/layouts/yoga.tsx` wrapper
3. Implement Grid/Split on top of Yoga
4. Remove both current implementations

**Why**: Better for future complex layouts, but overkill now.

### Option C: Keep Both (NOT RECOMMENDED)
- Two ways to do the same thing
- Confusion for users
- Maintenance burden

---

## Decision Points for User

1. **Are bugs #61/#62 blockers for you right now?**
   - If yes → Merge fix immediately (Option A)
   - If no → Could consider Yoga refactor

2. **Do you need advanced flexbox features?**
   - flex-grow/shrink, gaps, min/max constraints?
   - If yes → Yoga makes sense
   - If no → Userland Grid is sufficient

3. **Concerns about the 200KB Yoga bundle?**
   - For server-side video rendering: probably fine
   - For browser SDK: might matter

---

## Files to Change (Option A)

### Merge fix
```bash
git cherry-pick 412100a
```

### Remove native Split
- Delete: `src/react/renderers/split.ts`
- Update: `src/react/renderers/clip.ts` (remove split case)
- Update: `src/react/types.ts` (remove SplitProps if unused)

### Keep userland
- Keep: `src/react/layouts/grid.tsx`
- Keep: `src/react/layouts/split.tsx`
- Keep: `src/react/layouts/slot.tsx`
