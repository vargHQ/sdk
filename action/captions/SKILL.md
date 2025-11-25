---
name: video-captions
description: add auto-generated or custom subtitles to videos using groq/fireworks transcription and ffmpeg overlay. use when adding captions, subtitles, or text overlays to videos for accessibility or social media.
allowed-tools: Read, Bash
---

# video captions

automatically generate and overlay subtitles on videos with customizable styling.

## features

- **auto-generation**: transcribe video audio using groq or fireworks
- **custom srt support**: use existing subtitle files
- **styling**: customize font, size, colors, position
- **word-level timing**: fireworks provides precise word timestamps
- **instant overlay**: ffmpeg-based subtitle rendering

## usage

### auto-generate captions
```bash
bun run service/captions.ts <videoPath> [outputPath] [options]
```

**basic example:**
```bash
bun run service/captions.ts media/video.mp4
# outputs: media/video-captioned.mp4
```

**with options:**
```bash
bun run service/captions.ts media/video.mp4 output.mp4 --provider fireworks --font Arial --size 28
```

### use existing srt file
```bash
bun run service/captions.ts media/video.mp4 output.mp4 --srt media/video.srt
```

## options

- `--srt <path>` - use existing srt file instead of auto-generating
- `--provider <name>` - groq or fireworks (default: fireworks)
- `--font <name>` - font name (default: Arial)
- `--size <number>` - font size (default: 24)
- `--color <hex>` - primary color in ASS format (default: &HFFFFFF white)
- `--outline <hex>` - outline color in ASS format (default: &H000000 black)

## as library

```typescript
import { addCaptions } from "./service/captions"

const result = await addCaptions({
  videoPath: "media/video.mp4",
  output: "captioned.mp4",
  provider: "fireworks", // or "groq"
  style: {
    fontName: "Helvetica",
    fontSize: 28,
    primaryColor: "&HFFFFFF",
    outlineColor: "&H000000",
    bold: true,
    alignment: 2, // bottom center
    marginV: 20
  }
})
```

## providers

### fireworks (recommended)
- **word-level timestamps** for precise timing
- generates `.srt` format with detailed timing
- better for social media content
- slightly slower transcription

### groq
- **ultra-fast** transcription
- plain text output (converted to srt)
- sentence-level timing
- great for quick previews

## styling options

```typescript
interface SubtitleStyle {
  fontName?: string      // default: Arial
  fontSize?: number      // default: 24
  primaryColor?: string  // default: &HFFFFFF (white)
  outlineColor?: string  // default: &H000000 (black)
  bold?: boolean         // default: true
  alignment?: number     // 1-9, default: 2 (bottom center)
  marginV?: number       // vertical margin, default: 20
}
```

**alignment values:**
```
1 = bottom left    2 = bottom center    3 = bottom right
4 = middle left    5 = middle center    6 = middle right
7 = top left       8 = top center       9 = top right
```

## when to use

use this skill when:
- preparing videos for social media (tiktok, instagram, youtube)
- adding accessibility features
- creating educational or tutorial content
- need word-level caption timing
- translating videos with custom srt files

## typical workflow

1. create or edit video
2. add captions with auto-transcription (this service)
3. customize style for platform
4. prepare for social media (edit service)

## examples

**tiktok/instagram style captions:**
```bash
bun run service/captions.ts video.mp4 captioned.mp4 \
  --provider fireworks \
  --font "Arial Black" \
  --size 32 \
  --color "&H00FFFF"
```

**professional style:**
```bash
bun run service/captions.ts video.mp4 output.mp4 \
  --provider fireworks \
  --font "Helvetica" \
  --size 24
```

**with existing subtitles:**
```bash
bun run service/captions.ts video.mp4 final.mp4 \
  --srt custom-subtitles.srt \
  --font "Arial" \
  --size 26
```

## output

- generates `.srt` file if auto-transcribing
- creates new video file with burned-in subtitles
- preserves original video quality
- audio is copied without re-encoding

## environment variables

required (for auto-transcription):
- `GROQ_API_KEY` - for groq provider
- `FIREWORKS_API_KEY` - for fireworks provider

**system requirements:**
- ffmpeg must be installed

## processing time

- transcription: 5-30 seconds (depending on video length)
- overlay: 5-15 seconds (depending on video length)
- total: typically under 1 minute
