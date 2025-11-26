---
name: music-generation
description: generate full songs and instrumentals using sonauto v2 via fal.ai. create music in any style with customizable tags, lyrics, tempo, and output formats. use when user needs background music, theme songs, soundtracks, or custom audio tracks.
allowed-tools: Read, Bash
---

# music generation

generate complete songs with vocals or instrumental tracks using sonauto v2 text-to-music model.

## features

- **text-to-music** - describe the song you want in natural language
- **style tags** - specify exact genres and musical styles
- **custom lyrics** - provide lyrics or generate instrumentals
- **tempo control** - set bpm or auto-detect from style
- **multiple formats** - output as mp3, wav, flac, ogg, or m4a
- **multi-song generation** - generate up to 2 variations at once
- **reproducible** - use seed parameter to regenerate same song

## usage

### generate from prompt
```bash
bun run service/music generate <prompt> [format] [numSongs] [upload]
```

**parameters:**
- `prompt` (required): natural language description of the song
- `format` (optional): mp3 (default), wav, flac, ogg, m4a
- `numSongs` (optional): 1 (default) or 2
- `upload` (optional): "true" to upload to s3

**examples:**
```bash
# simple generation
bun run service/music generate "A pop song about turtles flying"

# generate 2 versions as mp3
bun run service/music generate "upbeat electronic dance music" mp3 2

# generate and upload to s3
bun run service/music generate "sad acoustic ballad" mp3 1 true
```

### generate from style tags
```bash
bun run service/music tags <tag1> <tag2> ... [format] [upload]
```

**examples:**
```bash
# rock song
bun run service/music tags "rock" "energetic" "electric guitar"

# ambient track
bun run service/music tags "ambient" "calm" "ethereal" wav

# upload to s3
bun run service/music tags "jazz" "smooth" "piano" mp3 true
```

explore all available tags at: https://sonauto.ai/tag-explorer

### generate instrumental
```bash
bun run service/music instrumental <tag1> <tag2> ... [format] [upload]
```

**examples:**
```bash
# piano instrumental
bun run service/music instrumental "piano" "calm" "ambient"

# electronic instrumental
bun run service/music instrumental "electronic" "upbeat" "synth" wav true
```

## as library

```typescript
import { generateMusic } from "./service/music"

// generate from prompt
const result = await generateMusic({
  prompt: "A pop song about summer",
  format: "mp3",
  upload: true,
  outputPath: "media/summer-song.mp3"
})

// generate from tags with custom lyrics
const customSong = await generateMusic({
  tags: ["rock", "energetic", "guitar"],
  lyrics: "Verse 1\nI'm walking down the street\nFeeling the beat\n\nChorus\nThis is my song",
  format: "mp3",
  bpm: 120,
  promptStrength: 2.5,
  outputPath: "media/custom-rock.mp3"
})

// generate instrumental
const instrumental = await generateMusic({
  tags: ["ambient", "calm", "piano"],
  lyrics: "", // empty for instrumental
  format: "wav",
  outputPath: "media/ambient-instrumental.wav"
})

console.log(result.seed) // save seed to regenerate exact song
console.log(result.audio[0].url)
console.log(result.uploadUrls)
```

## output

returns `MusicResult`:
```typescript
{
  seed: number,              // seed used (save for reproducibility)
  tags?: string[],           // style tags used
  lyrics?: string,           // lyrics used (if any)
  audio: Array<{
    url: string,             // download url
    fileName: string,        // original filename
    contentType: string,     // audio/mp3, audio/wav, etc
    fileSize: number         // size in bytes
  }>,
  uploadUrls?: string[]      // s3 urls if upload requested
}
```

saves audio file(s) to `media/music-{timestamp}.{format}`

## advanced options

```typescript
interface GenerateMusicOptions {
  prompt?: string;              // text description
  tags?: string[];              // style tags
  lyrics?: string;              // custom lyrics (empty string = instrumental)
  seed?: number;                // for reproducibility
  promptStrength?: number;      // 1.4-3.1, default 2 (higher = more prompt adherence)
  balanceStrength?: number;     // 0-1, default 0.7 (higher = more natural vocals)
  numSongs?: 1 | 2;            // generate variations (2 costs 1.5x)
  format?: string;              // output format
  bitRate?: 128 | 192 | 256 | 320;  // for mp3/m4a only
  bpm?: number | "auto";        // beats per minute
  upload?: boolean;             // upload to s3
  outputPath?: string;          // local save path
}
```

## when to use

use this skill when:
- creating background music for videos
- generating theme songs or intros
- producing soundtracks for content
- testing different musical styles quickly
- need instrumental tracks for voiceovers
- creating audio for social media content
- prototyping music ideas

## tips

**for better results:**
- be specific with style descriptions
- combine multiple style tags for unique sounds
- use "auto" bpm to let the model choose appropriate tempo
- generating 2 songs gives you variations to choose from
- save the seed if you want to recreate the exact same song
- use instrumental mode (empty lyrics) for background music

**prompt strength:**
- `1.4-2.0` - more natural, flowing music
- `2.0-2.5` - balanced (recommended)
- `2.5-3.1` - strict adherence to prompt (may sound less natural)

**balance strength:**
- `0.5-0.6` - sharper instrumentals, less clear vocals
- `0.7` - balanced (recommended)
- `0.8-1.0` - more natural vocals

**format selection:**
- `mp3` - best for web/social media (small size, good quality)
- `wav` - uncompressed, best for further editing
- `flac` - lossless compression
- `ogg` - open format, good compression
- `m4a` - apple devices, good compression

## integration with other services

perfect companion for:
- **video service** - add background music to generated videos
- **edit service** - combine music with video content
- **voice service** - create instrumentals for voiceovers
- **captions service** - sync music with captioned videos

## environment variables

required:
- `FAL_API_KEY` - for music generation

optional (for s3 upload):
- `CLOUDFLARE_R2_API_URL`
- `CLOUDFLARE_ACCESS_KEY_ID`
- `CLOUDFLARE_ACCESS_SECRET`
- `CLOUDFLARE_R2_BUCKET`

## generation time

expect 30-120 seconds depending on song complexity and duration. generating 2 songs takes longer but costs only 1.5x.

## cost

- 1 song: 1x credit
- 2 songs: 1.5x credit

## reproducibility

to regenerate the exact same song:
1. use the same `tags` and `lyrics` (not `prompt`)
2. use the same `seed` from the previous result
3. keep all other parameters identical
4. keep `numSongs` the same

note: using `prompt` instead of `tags` + `lyrics` will not guarantee reproducibility even with the same seed.

