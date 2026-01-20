# phase 3: audio pipeline & text rendering

goal: complete feature parity, all tests passing.

## scope

- [ ] audio decoding (AudioDecoder)
- [ ] audio mixing (multiple tracks)
- [ ] audio encoding (AudioEncoder aac)
- [ ] audio effects (fade in/out, volume, trim)
- [ ] audio normalization (dynaudnorm equivalent)
- [ ] text rendering (title, subtitle, news-title, slide-in-text)
- [ ] mux audio + video together

## tests to pass (remaining ~10 tests)

```
✓ creates video with title overlay (dynamic text)
✓ title with custom font
✓ subtitle layer
✓ title-background layer
✓ news-title layer
✓ slide-in-text layer
✓ subtitle continuous across clips
✓ audio layer in clip
✓ detached-audio layer with start offset
✓ loopAudio
✓ keepSourceAudio preserves original video audio
✓ keepSourceAudio with multiple clips and transitions
✓ keepSourceAudio with cutFrom stays in sync
✓ clipsAudioVolume controls source video audio level
✓ audioNorm normalizes audio levels
✓ audioTracks with cutFrom/cutTo/start
✓ audio crossfade during transitions
```

## implementation

### 1. audio decoder (`audio-decoder.ts`)

```typescript
class AudioSourceDecoder {
  decoder: AudioDecoder;
  sampleRate: number;
  channels: number;
  
  // decode entire audio track to Float32Array samples
  async decode(blob: Blob): Promise<AudioBuffer>;
  
  // get samples for time range
  getSamples(
    startTime: number,
    duration: number
  ): Float32Array[];
}
```

### 2. audio mixer (`audio-mixer.ts`)

```typescript
interface AudioTrackState {
  samples: Float32Array[];
  startTime: number;
  volume: number;
  fadeIn?: { duration: number; curve: string };
  fadeOut?: { duration: number; curve: string };
}

class AudioMixer {
  tracks: AudioTrackState[];
  sampleRate: number;
  
  addTrack(track: AudioTrackState): void;
  
  // mix all tracks for time range
  mix(startTime: number, duration: number): Float32Array[];
  
  // apply effects
  applyFade(samples: Float32Array[], fade: FadeConfig): Float32Array[];
  applyVolume(samples: Float32Array[], volume: number): Float32Array[];
  normalize(samples: Float32Array[]): Float32Array[];
}
```

### 3. audio encoder (`audio-encoder.ts`)

```typescript
class AudioEncoderWrapper {
  encoder: AudioEncoder;
  chunks: EncodedAudioChunk[];
  
  configure(sampleRate: number, channels: number): void;
  encode(samples: Float32Array[]): void;
  flush(): Promise<EncodedAudioChunk[]>;
}
```

### 4. text renderer (`text-renderer.ts`)

```typescript
class TextRenderer {
  // use OffscreenCanvas 2D for text
  canvas: OffscreenCanvas;
  ctx: OffscreenCanvasRenderingContext2D;
  
  // render text to ImageBitmap for compositing
  renderTitle(opts: TitleOptions): ImageBitmap;
  renderSubtitle(opts: SubtitleOptions): ImageBitmap;
  renderNewsTitle(opts: NewsTitleOptions): ImageBitmap;
  renderSlideInText(opts: SlideInTextOptions, progress: number): ImageBitmap;
}

interface TitleOptions {
  text: string;
  textColor: string;
  fontPath?: string;  // load via FontFace api
  fontFamily?: string;
  position: Position;
  width: number;
  height: number;
}
```

### 5. font loading

```typescript
async function loadFont(fontPath: string): Promise<FontFace> {
  const response = await fetch(fontPath);
  const buffer = await response.arrayBuffer();
  const font = new FontFace('CustomFont', buffer);
  await font.load();
  document.fonts.add(font);
  return font;
}
```

### 6. updated muxer

```typescript
function muxToMp4(
  videoChunks: EncodedVideoChunk[],
  audioChunks: EncodedAudioChunk[],
  config: MuxConfig
): Uint8Array;
```

## audio crossfade during transitions

when clips transition, need to:
1. fade out audio from clip A
2. fade in audio from clip B
3. mix during overlap period

```typescript
function calculateAudioCrossfade(
  clipAudio: AudioTrackState,
  nextClipAudio: AudioTrackState,
  transitionDuration: number,
  transitionCurve: CurveType
): void {
  // apply fadeOut to clipAudio ending
  // apply fadeIn to nextClipAudio beginning
}
```

## curve types for fades

map ffmpeg curve types to web audio:
- tri (linear)
- qsin (quarter sine)
- hsin (half sine)
- log (logarithmic)
- exp (exponential)
- etc.

## estimated time: 8-10 hours

## total project estimate

| phase | time | tests |
|-------|------|-------|
| phase 1 | 4-6h | 10 |
| phase 2 | 6-8h | 25 |
| phase 3 | 8-10h | 35+ |
| **total** | **18-24h** | **all** |
