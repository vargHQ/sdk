---
name: audio-transcription
description: transcribe audio to text or subtitles using groq whisper or fireworks with srt/vtt support. use when converting speech to text, generating subtitles, or need word-level timestamps for captions.
allowed-tools: Read, Bash
---

# audio transcription

convert audio to text or subtitle files using ai transcription.

## providers

### groq (ultra-fast)
- uses whisper-large-v3
- fastest transcription (~5-10 seconds)
- plain text output
- sentence-level timing
- best for: quick transcripts, text extraction

### fireworks (word-level)
- uses whisper-v3
- word-level timestamps
- outputs srt or vtt format
- precise subtitle timing
- best for: captions, subtitles, timed transcripts

## usage

### basic transcription
```bash
bun run service/transcribe.ts <audioUrl> <provider> [outputPath]
```

**example:**
```bash
bun run service/transcribe.ts media/audio.mp3 groq
bun run service/transcribe.ts media/audio.mp3 fireworks output.srt
```

### with output format
```bash
bun run lib/fireworks.ts <audioPath> <outputPath>
```

**example:**
```bash
bun run lib/fireworks.ts media/audio.mp3 output.srt
```

## as library

```typescript
import { transcribe } from "./service/transcribe"

// groq transcription
const groqResult = await transcribe({
  audioUrl: "media/audio.mp3",
  provider: "groq",
  outputFormat: "text"
})
console.log(groqResult.text)

// fireworks with srt
const fireworksResult = await transcribe({
  audioUrl: "media/audio.mp3",
  provider: "fireworks",
  outputFormat: "srt",
  outputPath: "subtitles.srt"
})
console.log(fireworksResult.text)
console.log(fireworksResult.outputPath) // subtitles.srt
```

## output formats

### text (groq default)
```
This is the transcribed text from the audio file.
All words in plain text format.
```

### srt (subtitle format)
```
1
00:00:00,000 --> 00:00:02,500
This is the first subtitle

2
00:00:02,500 --> 00:00:05,000
This is the second subtitle
```

### vtt (web video text tracks)
```
WEBVTT

00:00:00.000 --> 00:00:02.500
This is the first subtitle

00:00:02.500 --> 00:00:05.000
This is the second subtitle
```

## when to use

use this skill when:
- converting speech to text
- generating subtitles for videos
- creating accessible content
- need word-level timing for captions
- extracting dialogue from media
- preparing transcripts for analysis

## provider comparison

| feature | groq | fireworks |
|---------|------|-----------|
| speed | ultra-fast (5-10s) | moderate (15-30s) |
| output | plain text | srt/vtt with timestamps |
| timing | sentence-level | word-level |
| use case | quick transcripts | precise subtitles |

## typical workflows

### for captions
1. record or generate audio (voice service)
2. transcribe with fireworks (this service)
3. add captions to video (captions service)

### for transcripts
1. extract audio from video
2. transcribe with groq (this service)
3. use text for analysis or documentation

## tips

**provider selection:**
- use **groq** when you just need the text fast
- use **fireworks** when you need subtitle files
- use **fireworks** for captions on social media videos

**audio quality:**
- clear audio transcribes more accurately
- reduce background noise when possible
- supports mp3, wav, m4a, and most audio formats

**timing accuracy:**
- fireworks provides word-level timestamps
- perfect for lip-sync verification
- great for precise subtitle placement

## integration with other services

perfect companion for:
- **captions service** - auto-generate video subtitles
- **voice service** - transcribe generated speech
- **sync service** - verify audio timing

## environment variables

required:
- `GROQ_API_KEY` - for groq provider
- `FIREWORKS_API_KEY` - for fireworks provider

## processing time

- **groq**: 5-10 seconds (any audio length)
- **fireworks**: 15-30 seconds (depending on audio length)

## supported formats

input audio:
- mp3, wav, m4a, ogg, flac
- video files (extracts audio automatically)

output formats:
- text (plain text)
- srt (subtitles)
- vtt (web video text tracks)
