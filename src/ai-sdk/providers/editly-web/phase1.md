# phase 1: mvp - basic video compositing

goal: get simplest possible video output working end-to-end.

## scope

- [x] project structure
- [ ] video source decoding (VideoDecoder + mp4box)
- [ ] image source loading (ImageBitmap)
- [ ] basic webgl compositor (single layer, scale to fit)
- [ ] video encoding (VideoEncoder h264)
- [ ] mp4 muxing (mp4-muxer)
- [ ] no audio (silent output)

## tests to pass (10 tests)

```
✓ requires outPath
✓ requires at least one clip
✓ creates video with fill-color
✓ creates video with title overlay (title as bitmap, not dynamic)
✓ image ken burns preserves aspect ratio (static image, no zoom yet)
✓ contain-blur resize mode for video
✓ contain-blur resize mode for image
✓ portrait 9:16 image with zoompan - square image cover mode (no zoom)
✓ portrait 9:16 native image with zoompan (no zoom)
✓ gradients (linear/radial via webgl)
```

## implementation

### 1. source loader (`sources.ts`)

```typescript
interface FrameSource {
  type: 'video' | 'image';
  getFrame(time: number): Promise<VideoFrame | ImageBitmap>;
  duration: number;
  width: number;
  height: number;
  close(): void;
}

// video: use mp4box.js to demux, VideoDecoder to decode
// image: use createImageBitmap()
```

### 2. compositor (`compositor.ts`)

```typescript
class WebGLCompositor {
  canvas: OffscreenCanvas;
  gl: WebGL2RenderingContext;
  
  // basic operations
  clear(color: string): void;
  drawFrame(frame: VideoFrame | ImageBitmap, opts: DrawOptions): void;
  drawGradient(type: 'linear' | 'radial', colors: [string, string]): void;
  
  // get current frame for encoding
  getFrame(): VideoFrame;
}
```

### 3. encoder (`encoder.ts`)

```typescript
class VideoEncoderWrapper {
  encoder: VideoEncoder;
  chunks: EncodedVideoChunk[];
  
  configure(width: number, height: number, fps: number): void;
  encode(frame: VideoFrame): void;
  flush(): Promise<EncodedVideoChunk[]>;
}
```

### 4. muxer (`muxer.ts`)

```typescript
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

function muxToMp4(
  videoChunks: EncodedVideoChunk[],
  width: number,
  height: number,
  fps: number
): Uint8Array;
```

### 5. main entry (`index.ts`)

```typescript
export async function editlyWeb(config: EditlyConfig): Promise<Uint8Array> {
  // 1. process clips (same logic as original)
  // 2. for each frame:
  //    - get source frames
  //    - composite via webgl
  //    - encode
  // 3. mux and return
}
```

## file structure

```
src/ai-sdk/providers/editly-web/
├── index.ts          # main entry, editlyWeb()
├── sources.ts        # VideoDecoder, ImageBitmap loaders
├── compositor.ts     # WebGL2 compositor
├── encoder.ts        # VideoEncoder wrapper
├── muxer.ts          # mp4-muxer wrapper
├── shaders/
│   ├── basic.vert    # vertex shader
│   ├── basic.frag    # fragment shader
│   └── gradient.frag # gradient shader
├── plan.md
├── phase1.md
├── phase2.md
├── phase3.md
└── editly-web.test.ts
```

## estimated time: 4-6 hours
