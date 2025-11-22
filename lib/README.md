# lib/ modules

## two fal implementations

### lib/ai-sdk/fal.ts - ai-sdk provider (recommended for images)

uses `@ai-sdk/fal` with the vercel ai sdk's `experimental_generateImage`

**benefits:**
- clean, typed api via vercel ai sdk
- automatic image format handling (uint8array)
- consistent interface with other ai providers
- built-in aspect ratio support
- better for standard image generation

**example:**
```bash
bun run lib/ai-sdk/fal.ts generate_image "cyberpunk city" "fal-ai/flux/dev" "16:9"
```

**code:**
```typescript
import { fal } from "@ai-sdk/fal"
import { experimental_generateImage as generateImage } from "ai"

const { image, providerMetadata } = await generateImage({
  model: fal.image("fal-ai/flux/dev"),
  prompt: "beautiful sunset",
  aspectRatio: "16:9",
})
```

### lib/fal.ts - fal client direct (for video & advanced features)

uses `@fal-ai/client` directly with the raw fal api

**benefits:**
- access to all fal features (video, advanced params)
- streaming/queue updates
- full control over api parameters
- required for video generation (no ai-sdk support yet)

**example:**
```bash
bun run lib/fal.ts generate_image "aurora borealis" "fal-ai/flux-pro/v1.1"
bun run lib/fal.ts image_to_video "person talking" "https://image.url" 5
```

**code:**
```typescript
import { fal } from "@fal-ai/client"

const result = await fal.subscribe("fal-ai/flux-pro/v1.1", {
  input: {
    prompt: "mountain landscape",
    image_size: "landscape_4_3",
  },
  logs: true,
  onQueueUpdate: (update) => {
    console.log(update.status)
  },
})
```

## when to use which?

| use case | approach |
|----------|----------|
| standard image generation | ai-sdk provider ✓ |
| video generation | fal client direct ✓ |
| advanced fal features | fal client direct ✓ |
| multi-provider app | ai-sdk provider ✓ |
| custom queue handling | fal client direct ✓ |

## higgsfield.ts

uses `@higgsfield/client` for soul character generation

**features:**
- generate soul images with custom styles
- create and manage character references
- list available soul styles
- poll for job completion

**example:**
```bash
HF_API_KEY=xxx HF_API_SECRET=xxx bun run lib/higgsfield.ts generate_soul "professional headshot"
```

## elevenlabs.ts

uses `@elevenlabs/elevenlabs-js` for voice, music, and sound effects generation

**features:**
- text-to-speech with multiple voices
- music generation from text prompts
- sound effects generation
- voice management

**examples:**
```bash
# text-to-speech
bun run lib/elevenlabs.ts tts "hello world" rachel output.mp3

# music generation
bun run lib/elevenlabs.ts music "upbeat electronic dance music" 30000 music.mp3

# sound effects
bun run lib/elevenlabs.ts sfx "ocean waves crashing" 5 waves.mp3

# list voices
bun run lib/elevenlabs.ts voices
```

**code:**
```typescript
import { textToSpeech, generateMusic, generateSoundEffect } from "./lib/elevenlabs"

// voice
const audio = await textToSpeech({
  text: "hello world",
  voiceId: "rachel",
  outputPath: "output.mp3"
})

// music
const music = await generateMusic({
  prompt: "epic orchestral music",
  musicLengthMs: 60000,
  outputPath: "music.mp3"
})

// sound effects
const sfx = await generateSoundEffect({
  text: "thunder and rain",
  durationSeconds: 10,
  outputPath: "sfx.mp3"
})
```
