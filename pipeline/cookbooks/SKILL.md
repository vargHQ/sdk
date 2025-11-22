---
name: talking-character-pipeline
description: complete workflow to create talking character videos with lipsync and captions. use when creating ai character videos, talking avatars, narrated content, or social media character content with voiceover.
allowed-tools: Read, Bash
---

# talking character pipeline

create professional talking character videos from scratch using the complete varg.ai sdk workflow.

## overview

this pipeline combines multiple services to create a fully produced talking character video:
1. character headshot generation
2. voiceover synthesis
3. character animation
4. lipsync
5. auto-generated captions
6. social media optimization

**total time**: ~4-5 minutes per video

## step-by-step workflow

### 1. create character headshot
```bash
bun run service/image.ts soul "professional headshot of a friendly person, studio lighting" true
```

**output**: character image url + s3 url  
**time**: ~30 seconds

**tip**: be specific about character appearance, lighting, and style for best results

### 2. generate voiceover
```bash
bun run service/voice.ts elevenlabs "hello world, this is my character speaking" rachel true
```

**output**: `media/voice-{timestamp}.mp3` + s3 url  
**time**: ~10 seconds

**tip**: choose voice that matches character (rachel/bella for female, josh/antoni for male)

### 3. animate character
```bash
bun run service/video.ts from_image "person talking naturally, professional demeanor" <headshot_url> 5 true
```

**output**: animated video url + s3 url  
**time**: ~2-3 minutes

**tip**: use subtle motion prompts like "person talking naturally" or "slight head movement"

### 4. add lipsync
```bash
bun run service/sync.ts wav2lip <video_url> <audio_url>
```

**output**: lipsynced video url  
**time**: ~30 seconds

**tip**: wav2lip works best with close-up character shots and clear audio

### 5. add captions
```bash
bun run service/captions.ts <video_path> captioned.mp4 --provider fireworks
```

**output**: `captioned.mp4` with subtitles  
**time**: ~15 seconds (includes transcription)

**tip**: fireworks provider gives word-level timing for professional captions

### 6. prepare for social media
```bash
bun run service/edit.ts social captioned.mp4 final-tiktok.mp4 tiktok
```

**output**: `final-tiktok.mp4` optimized for platform  
**time**: ~5 seconds

**platforms**: tiktok, instagram, youtube-shorts, youtube, twitter

## complete example

```bash
# step 1: generate character
bun run service/image.ts soul \
  "professional business woman, friendly smile, studio lighting" \
  true

# step 2: create voiceover
bun run service/voice.ts elevenlabs \
  "welcome to our company. we're excited to show you our new product" \
  rachel \
  true

# step 3: animate character
bun run service/video.ts from_image \
  "person talking professionally" \
  https://your-s3-url/character.jpg \
  5 \
  true

# step 4: sync lips
bun run service/sync.ts wav2lip \
  https://your-s3-url/animated.mp4 \
  https://your-s3-url/voice.mp3

# step 5: add captions
bun run service/captions.ts \
  synced-video.mp4 \
  captioned.mp4 \
  --provider fireworks \
  --font "Arial Black" \
  --size 32

# step 6: optimize for tiktok
bun run service/edit.ts social \
  captioned.mp4 \
  final-tiktok.mp4 \
  tiktok
```

## programmatic workflow

```typescript
import { generateWithSoul } from "./service/image"
import { generateVoice } from "./service/voice"
import { generateVideoFromImage } from "./service/video"
import { lipsyncWav2Lip } from "./service/sync"
import { addCaptions } from "./service/captions"
import { prepareForSocial } from "./service/edit"

// 1. character
const character = await generateWithSoul(
  "friendly business person, professional",
  { upload: true }
)

// 2. voice
const voice = await generateVoice({
  text: "hello, welcome to our video",
  voice: "rachel",
  upload: true,
  outputPath: "media/voice.mp3"
})

// 3. animate
const video = await generateVideoFromImage(
  "person talking naturally",
  character.uploaded!,
  { duration: 5, upload: true }
)

// 4. lipsync
const synced = await lipsyncWav2Lip({
  videoUrl: video.uploaded!,
  audioUrl: voice.uploadUrl!
})

// 5. captions
const captioned = await addCaptions({
  videoPath: synced,
  output: "captioned.mp4",
  provider: "fireworks"
})

// 6. social media
const final = await prepareForSocial({
  input: captioned,
  output: "final.mp4",
  platform: "tiktok"
})
```

## use cases

### marketing content
- product announcements
- brand messaging
- explainer videos
- social media ads

### educational content
- course introductions
- tutorial narration
- lesson summaries
- educational social media

### social media
- tiktok character content
- instagram reels with narration
- youtube shorts
- twitter video posts

## tips for best results

**character creation:**
- be specific about appearance, expression, lighting
- "professional", "friendly", "casual" work well
- mention "studio lighting" for clean backgrounds

**voiceover:**
- write natural, conversational scripts
- add punctuation for natural pauses
- keep sentences short and clear
- match voice gender to character

**animation:**
- use subtle motion prompts
- 5 seconds is perfect for character talking shots
- avoid complex camera movements

**lipsync:**
- wav2lip works best with frontal face views
- ensure audio is clear and well-paced
- close-up shots give better results

**captions:**
- use fireworks for word-level timing
- larger font sizes (28-32) work better on mobile
- white text with black outline is most readable

**social media:**
- vertical (9:16) for tiktok/instagram/shorts
- landscape (16:9) for youtube/twitter
- keep total video under 60 seconds for best engagement

## estimated costs

per video (approximate):
- character image: $0.05 (higgsfield soul)
- voiceover: $0.10 (elevenlabs)
- animation: $0.20 (fal image-to-video)
- lipsync: $0.10 (replicate wav2lip)
- transcription: $0.02 (fireworks)

**total**: ~$0.47 per video

## troubleshooting

**character doesn't look consistent:**
- use higgsfield soul instead of fal for characters
- save character image and reuse for consistency

**lipsync doesn't match well:**
- ensure video shows face clearly
- use close-up shots
- check audio quality and clarity

**animation looks unnatural:**
- simplify motion prompt
- use "person talking naturally" or "slight movement"
- avoid dramatic camera movements

**captions are off-sync:**
- use fireworks provider for better timing
- check audio quality
- verify video fps is standard (24/30fps)

## required environment variables

```bash
HIGGSFIELD_API_KEY=hf_xxx
HIGGSFIELD_SECRET=secret_xxx
ELEVENLABS_API_KEY=el_xxx
FAL_API_KEY=fal_xxx
REPLICATE_API_TOKEN=r8_xxx
FIREWORKS_API_KEY=fw_xxx
CLOUDFLARE_R2_API_URL=https://xxx.r2.cloudflarestorage.com
CLOUDFLARE_ACCESS_KEY_ID=xxx
CLOUDFLARE_ACCESS_SECRET=xxx
CLOUDFLARE_R2_BUCKET=m
```

## next steps

after creating your talking character video:
- upload to social platforms
- analyze performance metrics
- iterate on character design and scripts
- create series with consistent character
- experiment with different voices and styles
