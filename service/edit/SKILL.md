---
name: video-editing
description: edit videos with ffmpeg operations including resize, trim, concat, social media optimization, and montage creation. use for video editing, format conversion, social media prep, merging clips, or batch video operations.
allowed-tools: Read, Bash
---

# video editing

comprehensive video editing service combining ffmpeg operations into common workflows.

## commands

### prepare for social media
```bash
bun run service/edit.ts social <input> <output> <platform> [audioPath]
```

automatically resize and optimize for platform specs:
- **tiktok**: 1080x1920 (9:16)
- **instagram**: 1080x1920 (9:16)
- **youtube-shorts**: 1080x1920 (9:16)
- **youtube**: 1920x1080 (16:9)
- **twitter**: 1280x720 (16:9)

**example:**
```bash
bun run service/edit.ts social raw.mp4 tiktok.mp4 tiktok
bun run service/edit.ts social raw.mp4 ig.mp4 instagram audio.mp3
```

### create montage
```bash
bun run service/edit.ts montage <output> <clip1> <clip2> [clip3...]
```

combine multiple video clips into one:

**example:**
```bash
bun run service/edit.ts montage final.mp4 intro.mp4 main.mp4 outro.mp4
```

### quick trim
```bash
bun run service/edit.ts trim <input> <output> <start> [end]
```

extract a segment from video:

**example:**
```bash
bun run service/edit.ts trim long.mp4 short.mp4 10 30
# extracts seconds 10-30
```

### quick resize
```bash
bun run service/edit.ts resize <input> <output> <preset>
```

resize to common aspect ratios:
- **vertical**: 9:16 (1080x1920)
- **square**: 1:1 (1080x1080)
- **landscape**: 16:9 (1920x1080)
- **4k**: 3840x2160

**example:**
```bash
bun run service/edit.ts resize raw.mp4 vertical.mp4 vertical
```

### merge with audio
```bash
bun run service/edit.ts merge_audio <audio> <output> <video1> [video2...]
```

concatenate videos and add audio overlay:

**example:**
```bash
bun run service/edit.ts merge_audio song.mp3 final.mp4 clip1.mp4 clip2.mp4
```

## as library

```typescript
import { 
  prepareForSocial,
  createMontage,
  quickTrim,
  quickResize,
  mergeWithAudio,
  editPipeline
} from "./service/edit"

// social media optimization
await prepareForSocial({
  input: "raw.mp4",
  output: "tiktok.mp4",
  platform: "tiktok",
  withAudio: "audio.mp3"
})

// create montage
await createMontage({
  clips: ["clip1.mp4", "clip2.mp4"],
  output: "montage.mp4",
  maxClipDuration: 5,
  targetResolution: { width: 1920, height: 1080 }
})

// trim video
await quickTrim("video.mp4", "trimmed.mp4", 10, 30)

// resize video
await quickResize("video.mp4", "resized.mp4", "vertical")

// merge videos with audio
await mergeWithAudio(
  ["clip1.mp4", "clip2.mp4"],
  "audio.mp3",
  "final.mp4"
)
```

## advanced: edit pipeline

chain multiple operations:

```typescript
import { editPipeline } from "./service/edit"

await editPipeline({
  steps: [
    {
      operation: "resize",
      options: {
        input: "raw.mp4",
        width: 1080,
        height: 1920
      }
    },
    {
      operation: "add_audio",
      options: {
        videoPath: "temp.mp4",
        audioPath: "music.mp3"
      }
    },
    {
      operation: "trim",
      options: {
        input: "temp2.mp4",
        start: 0,
        duration: 30
      }
    }
  ],
  finalOutput: "final.mp4"
})
```

**available operations:**
- `concat` - concatenate videos
- `add_audio` - overlay audio
- `resize` - change dimensions
- `trim` - extract segment
- `convert` - change format
- `extract_audio` - extract audio track

## when to use

use this skill when:
- preparing videos for social media platforms
- combining multiple video clips
- extracting segments from longer videos
- resizing to specific aspect ratios
- adding background music to video montages
- batch processing video files
- optimizing videos for specific platforms

## typical workflows

### social media content
1. create or edit raw video
2. add captions (captions service)
3. prepare for platform (this service)
4. upload

### video montage
1. collect multiple clips
2. create montage (this service)
3. add audio overlay (this service)
4. add captions if needed (captions service)

### talking character for social
1. generate character (image service)
2. animate (video service)
3. sync with voice (sync service)
4. add captions (captions service)
5. optimize for tiktok/instagram (this service)

## tips

**social media optimization:**
- use platform-specific presets for correct aspect ratio
- vertical format (9:16) works for tiktok, instagram reels, youtube shorts
- landscape (16:9) works for youtube, twitter

**montage creation:**
- all clips should have similar resolution for best results
- use `maxClipDuration` to keep montage paced
- `targetResolution` ensures consistent quality

**trimming:**
- start time is in seconds
- end time is optional (omit to trim to end of video)
- use for extracting highlights or removing unwanted sections

## environment variables

no api keys required - uses ffmpeg

**system requirements:**
- ffmpeg must be installed
- `brew install ffmpeg` (macos)
- `apt-get install ffmpeg` (linux)

## processing time

depends on operation and video size:
- trim: 5-10 seconds
- resize: 10-30 seconds
- concat: 10-30 seconds per clip
- social optimization: 15-45 seconds
