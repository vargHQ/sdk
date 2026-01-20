# editly-web

browser-native video compositor using webcodecs. drop-in replacement for editly (ffmpeg).

## why

- **no server needed** - runs entirely in browser
- **gpu accelerated** - hardware video encoding via webcodecs
- **privacy** - user data never leaves their device
- **cost** - offload compute to client

## architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        editly-web                           │
├─────────────────────────────────────────────────────────────┤
│  same types.ts interface as editly                          │
│  EditlyConfig → Uint8Array (mp4)                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Source       │  │ Compositor   │  │ Encoder      │      │
│  │ Loaders      │  │ (WebGL)      │  │ (WebCodecs)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                 │                 │               │
│         ▼                 ▼                 ▼               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ VideoDecoder │  │ OffscreenCanvas│ │ VideoEncoder │      │
│  │ ImageBitmap  │  │ WebGL2       │  │ AudioEncoder │      │
│  │ AudioDecoder │  │ gl-transitions│ │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                             │
│                          │                                  │
│                          ▼                                  │
│                   ┌──────────────┐                         │
│                   │ mp4-muxer    │                         │
│                   │ (mux.js)     │                         │
│                   └──────────────┘                         │
│                          │                                  │
│                          ▼                                  │
│                   ┌──────────────┐                         │
│                   │ Uint8Array   │                         │
│                   │ (final mp4)  │                         │
│                   └──────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

## pipeline flow

```
1. parse EditlyConfig
2. for each frame (0 to totalDuration * fps):
   a. decode/load source frames (video/image) for current time
   b. composite layers onto OffscreenCanvas via WebGL
   c. apply transitions between clips if in transition zone
   d. encode frame via VideoEncoder
   e. decode/mix audio samples for current time
   f. encode audio via AudioEncoder
3. mux video + audio chunks into mp4
4. return Uint8Array
```

## dependencies

| package | purpose |
|---------|---------|
| mp4-muxer | mux encoded chunks to mp4 container |
| mp4box.js | demux input videos for decoding |
| gl-transitions | webgl transition shaders (already used in original editly) |

## api compatibility

```typescript
// exact same interface as editly
import { editlyWeb } from './editly-web';

await editlyWeb({
  outPath: 'output.mp4', // ignored in browser, returns Uint8Array
  width: 1280,
  height: 720,
  fps: 30,
  clips: [
    { duration: 3, layers: [{ type: 'video', path: videoBlob }] },
    { duration: 2, layers: [{ type: 'image', path: imageBlob }] },
  ],
  audioTracks: [{ path: audioBlob }],
});
```

## differences from ffmpeg editly

| feature | ffmpeg editly | editly-web |
|---------|---------------|------------|
| input paths | file paths | Blob/URL/ArrayBuffer |
| output | writes to file | returns Uint8Array |
| transitions | 67+ gl-transitions | same (webgl native) |
| text rendering | ffmpeg drawtext | canvas 2d / bitmap fonts |
| audio filters | ffmpeg audio filters | web audio api |
| performance | native speed | ~2-5x slower (but gpu encoded) |

## test compatibility

all 30+ tests from editly.test.ts should pass with minimal changes:
- replace file paths with Blobs
- replace existsSync checks with Uint8Array length checks
- use happy-dom or playwright for webcodecs api
