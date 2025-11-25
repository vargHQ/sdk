---
name: voice-synthesis
description: generate realistic text-to-speech audio using elevenlabs with multiple voice options. use when user needs voiceovers, narration, character voices, or audio for lipsync videos.
allowed-tools: Read, Bash
---

# voice synthesis

generate high-quality text-to-speech audio with elevenlabs.

## available voices

- **rachel** - clear, professional female voice
- **domi** - warm, friendly female voice
- **bella** - energetic female voice
- **antoni** - friendly male voice
- **elli** - young, clear female voice
- **josh** - deep, clear male voice
- **arnold** - strong, authoritative male voice
- **adam** - natural, conversational male voice
- **sam** - raspy, character male voice

## usage

### generate voice
```bash
bun run service/voice.ts generate <text> [voice] [provider] [upload]
```

**parameters:**
- `text` (required): text to convert to speech
- `voice` (optional): voice name (default: rachel)
- `provider` (optional): elevenlabs (default)
- `upload` (optional): "true" to upload to s3

**example:**
```bash
bun run service/voice.ts generate "hello world, this is my voice" rachel elevenlabs true
```

### shorthand for elevenlabs
```bash
bun run service/voice.ts elevenlabs <text> [voice] [upload]
```

**example:**
```bash
bun run service/voice.ts elevenlabs "welcome to our video" josh true
```

## as library

```typescript
import { generateVoice } from "./service/voice"

const result = await generateVoice({
  text: "hello world",
  voice: "rachel",
  provider: "elevenlabs",
  upload: true,
  outputPath: "media/voiceover.mp3"
})

console.log(result.provider)
console.log(result.voiceId)
console.log(result.uploadUrl)
```

## output

returns `VoiceResult`:
```typescript
{
  audio: Buffer,         // raw audio buffer
  provider: string,      // "elevenlabs"
  voiceId: string,       // actual voice id used
  uploadUrl?: string     // s3 url if upload requested
}
```

saves audio file to `media/voice-{timestamp}.mp3`

## when to use

use this skill when:
- creating voiceovers for videos
- generating narration or character dialogue
- preparing audio for lipsync videos
- need text-to-speech for talking character pipeline
- testing different voice options

## tips

**voice selection:**
- use **rachel** or **josh** for professional narration
- use **bella** or **antoni** for friendly, casual content
- use **arnold** for authoritative or dramatic content
- use **sam** for character or stylized voices

**text formatting:**
- add punctuation for natural pauses
- use shorter sentences for clearer speech
- spell out numbers and abbreviations

## integration with other services

perfect companion for:
- **lipsync service** - sync generated voice with video
- **video generation** - create talking character videos
- **captions service** - auto-generate subtitles from voiceover

## environment variables

required:
- `ELEVENLABS_API_KEY` - for voice generation

optional (for s3 upload):
- `CLOUDFLARE_R2_API_URL`
- `CLOUDFLARE_ACCESS_KEY_ID`
- `CLOUDFLARE_ACCESS_SECRET`
- `CLOUDFLARE_R2_BUCKET`

## generation time

expect 5-15 seconds depending on text length
