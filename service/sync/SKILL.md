---
name: video-lipsync
description: sync video with audio using wav2lip ai model or simple audio overlay. use when creating talking videos, matching lip movements to audio, or combining video with voiceovers.
allowed-tools: Read, Bash
---

# video lipsync

sync video with audio using ai-powered lipsync or simple overlay.

## methods

### wav2lip (ai-powered)
- uses replicate wav2lip model
- matches lip movements to audio
- works with url inputs
- processing time: 30-60 seconds
- best for: talking character videos

### overlay (simple)
- adds audio track to video using ffmpeg
- no lip movement matching
- works with local files
- processing time: instant
- best for: background music, voiceovers

## usage

### sync with method selection
```bash
bun run service/sync.ts sync <videoUrl> <audioUrl> [method] [output]
```

**parameters:**
- `videoUrl` (required): video file path or url
- `audioUrl` (required): audio file path or url
- `method` (optional): "wav2lip" or "overlay" (default: overlay)
- `output` (optional): output path (default: output-synced.mp4)

**example:**
```bash
bun run service/sync.ts sync video.mp4 audio.mp3 overlay output.mp4
```

### wav2lip direct
```bash
bun run service/sync.ts wav2lip <videoUrl> <audioUrl>
```

**example:**
```bash
bun run service/sync.ts wav2lip https://example.com/character.mp4 https://example.com/voice.mp3
```

### overlay direct
```bash
bun run service/sync.ts overlay <videoPath> <audioPath> [output]
```

**example:**
```bash
bun run service/sync.ts overlay character.mp4 narration.mp3 final.mp4
```

## as library

```typescript
import { lipsync, lipsyncWav2Lip, lipsyncOverlay } from "./service/sync"

// flexible sync
const result = await lipsync({
  videoUrl: "video.mp4",
  audioUrl: "audio.mp3",
  method: "wav2lip",
  output: "synced.mp4"
})

// wav2lip specific
const lipsynced = await lipsyncWav2Lip({
  videoUrl: "https://example.com/video.mp4",
  audioUrl: "https://example.com/audio.mp3"
})

// overlay specific
const overlayed = await lipsyncOverlay(
  "video.mp4",
  "audio.mp3",
  "output.mp4"
)
```

## when to use each method

### use wav2lip when:
- creating talking character videos
- lip movements must match speech
- have urls for video and audio
- quality is more important than speed

### use overlay when:
- adding background music
- audio doesn't require lip sync
- working with local files
- need instant processing

## typical workflow

1. generate character image (image service)
2. animate character (video service)
3. generate voiceover (voice service)
4. sync with wav2lip (this service)
5. add captions (captions service)

## tips

**for wav2lip:**
- use close-up character shots for best results
- ensure audio is clear and well-paced
- video should show face clearly
- works best with 5-10 second clips

**for overlay:**
- match audio length to video length
- ffmpeg will loop short audio or trim long audio
- preserves original video quality

## environment variables

required (for wav2lip):
- `REPLICATE_API_TOKEN` - for wav2lip model

no special requirements for overlay method (ffmpeg must be installed)

## error handling

if wav2lip fails, the service automatically falls back to overlay method with a warning message.
