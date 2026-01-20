# phase 2: transitions, ken burns, overlays

goal: visual feature parity with ffmpeg editly.

## scope

- [ ] transitions (xfade equivalent via gl-transitions)
- [ ] ken burns zoom/pan animation
- [ ] video overlays (pip)
- [ ] image overlays
- [ ] resize modes (contain, contain-blur, cover, stretch)
- [ ] layer start/stop timing

## tests to pass (15 additional tests)

```
✓ merges two videos with fade transition
✓ picture-in-picture (pip)
✓ pip with originX/originY
✓ pip continuous across clips
✓ multiple clips with transitions
✓ image ken burns preserves aspect ratio (with actual zoom)
✓ image pan left/right
✓ image-overlay with position presets
✓ image-overlay with ken burns zoom
✓ image-overlay continuous across clips
✓ layer start/stop timing
✓ rainbow-colors layer
✓ defaults.layer and defaults.layerType
```

## implementation

### 1. transitions (`transitions.ts`)

```typescript
import { createTransition } from 'gl-transitions';

class TransitionRenderer {
  // precompile common transitions
  transitions: Map<string, CompiledTransition>;
  
  // render transition frame
  render(
    fromFrame: VideoFrame,
    toFrame: VideoFrame,
    progress: number,  // 0-1
    transitionName: string
  ): void;
}
```

gl-transitions is already webgl-based, so this should be straightforward.

### 2. ken burns (`kenburns.ts`)

```typescript
interface KenBurnsState {
  zoomDirection: 'in' | 'out' | 'left' | 'right';
  zoomAmount: number;
  startZoom: number;
  endZoom: number;
  startPan: [number, number];
  endPan: [number, number];
}

function calculateKenBurnsTransform(
  state: KenBurnsState,
  progress: number  // 0-1 through clip
): { scale: number; translateX: number; translateY: number };
```

### 3. overlay compositor (`overlays.ts`)

```typescript
interface OverlayLayer {
  frame: VideoFrame | ImageBitmap;
  x: number;      // pixels
  y: number;      // pixels
  width: number;  // pixels
  height: number; // pixels
  originX: 'left' | 'center' | 'right';
  originY: 'top' | 'center' | 'bottom';
}

// extend WebGLCompositor
class WebGLCompositor {
  // ... existing methods
  
  drawOverlay(overlay: OverlayLayer): void;
  drawOverlays(overlays: OverlayLayer[]): void;
}
```

### 4. resize modes (`resize.ts`)

```typescript
type ResizeMode = 'contain' | 'contain-blur' | 'cover' | 'stretch';

function calculateResizeTransform(
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number,
  mode: ResizeMode
): {
  scale: number;
  offsetX: number;
  offsetY: number;
  // for contain-blur: blur background params
  needsBlurBackground: boolean;
};
```

contain-blur requires:
1. draw blurred, scaled-up version as background
2. draw properly scaled foreground on top

### 5. layer timing

```typescript
interface LayerTiming {
  start?: number;  // seconds from clip start
  stop?: number;   // seconds from clip start
}

function isLayerVisible(
  layer: Layer,
  clipTime: number,  // current time within clip
  clipDuration: number
): boolean;
```

## shaders to add

```glsl
// blur.frag - gaussian blur for contain-blur mode
// kenburns.vert - animated scale/translate
```

## estimated time: 6-8 hours
