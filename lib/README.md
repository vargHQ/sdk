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
- **supports local images** - automatically uploads local files to fal storage

**examples:**
```bash
# image generation
bun run lib/fal.ts generate_image "aurora borealis" "fal-ai/flux-pro/v1.1"

# video from url
bun run lib/fal.ts image_to_video "person talking" "https://image.url" 5

# video from local file (auto-uploads)
bun run lib/fal.ts image_to_video "ocean waves" "./media/beach.jpg" 10
```

**code:**
```typescript
import { imageToVideo } from "./lib/fal"

// works with both urls and local files
const result = await imageToVideo({
  prompt: "person talking",
  imageUrl: "./local/image.jpg", // or "https://..."
  duration: 5,
})

// local files are automatically uploaded to fal storage
```

## when to use which?

| use case | approach |
|----------|----------|
| standard image generation | ai-sdk provider ✓ |
| video generation | fal client direct ✓ |
| advanced fal features | fal client direct ✓ |
| multi-provider app | ai-sdk provider ✓ |
| custom queue handling | fal client direct ✓ |

## higgsfield/ - HTTP-based API

**NEW:** Now uses direct HTTP requests instead of `@higgsfield/client`

**features:**
- generate soul images with custom styles
- async queue pattern with polling
- webhook support for production
- manual queue management
- cancel pending requests
- list available soul styles

**benefits:**
- no external client library dependency
- full control over HTTP requests
- supports webhooks for async workflows
- compatible with the official API docs
- modular structure for different models

**examples:**
```bash
# simple generation
bun run lib/higgsfield/soul.ts generate "professional headshot"

# with style
bun run lib/higgsfield/soul.ts generate "portrait" "style-id"

# list styles
bun run lib/higgsfield/soul.ts list_styles

# check status
bun run lib/higgsfield/soul.ts status "request-id"

# cancel request
bun run lib/higgsfield/soul.ts cancel "request-id"

# backward compatible
bun run lib/higgsfield.ts generate_soul "professional headshot"
```

**code:**
```typescript
import { generateSoul, SoulSize, SoulQuality } from "./lib/higgsfield/soul"

// simple generation
const result = await generateSoul({
  prompt: "beautiful landscape",
  width_and_height: SoulSize.LANDSCAPE_1536x2048,
  quality: SoulQuality.HD,
})

console.log(result.images[0].url)

// with webhook (for production)
const request = await generateSoul(
  { prompt: "portrait" },
  { webhook: "https://your-webhook.url" }
)
```

**structure:**
```
lib/higgsfield/
├── index.ts      # Base HiggsfieldClient class
├── soul.ts       # Soul-specific API
├── example.ts    # Usage examples
└── README.md     # Detailed documentation
```

**migration from old client:**
- Response structure changed from `result.jobs[0].results.raw.url` to `result.images[0].url`
- Parameters use snake_case (e.g., `style_id` instead of `styleId`)
- Returns `GenerationResponse` with status tracking
- See `lib/higgsfield/README.md` for full migration guide

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
