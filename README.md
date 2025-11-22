# varg.ai sdk

video generation and editing tools sdk

## folder structure

```
sdk/
│
├── utilities/
│
├── lib/
│   ├── pymovie/
│   ├── opencv/
│   ├── fal/
│   ├── higgsfield/
│   ├── ffmpeg/
│   ├── remotion.dev/
│   └── motion.dev/
│
├── service/
│   ├── image/
│   ├── video/
│   ├── edit/           # video editing
│   ├── sync/           # lipsync
│   ├── captions/
│   └── voice/
│
└── pipeline/
    └── cookbooks/
```

## installation

```bash
bun install
```

set environment variables in `.env`:
```bash
FAL_API_KEY=fal_xxx
HIGGSFIELD_API_KEY=hf_xxx
HIGGSFIELD_SECRET=secret_xxx
REPLICATE_API_TOKEN=r8_xxx
ELEVENLABS_API_KEY=el_xxx
CLOUDFLARE_R2_API_URL=https://xxx.r2.cloudflarestorage.com
CLOUDFLARE_ACCESS_KEY_ID=xxx
CLOUDFLARE_ACCESS_SECRET=xxx
CLOUDFLARE_R2_BUCKET=m
```

## usage

### as cli

```bash
# generate image with ai-sdk (recommended)
bun run lib/ai-sdk/fal.ts generate_image "a beautiful sunset" "fal-ai/flux/dev" "16:9"

# generate image with fal client (advanced features)
bun run lib/fal.ts generate_image "a beautiful sunset"

# generate video from image
bun run lib/fal.ts image_to_video "person talking" https://example.com/image.jpg 5

# generate soul character
bun run lib/higgsfield.ts generate_soul "professional headshot"

# generate video with replicate
bun run lib/replicate.ts minimax "person walking on beach"

# generate voice with elevenlabs
bun run lib/elevenlabs.ts tts "hello world" rachel output.mp3

# edit video with ffmpeg
bun run lib/ffmpeg.ts concat output.mp4 video1.mp4 video2.mp4

# lipsync video with audio
bun run service/sync.ts overlay video.mp4 audio.mp3 synced.mp4

# upload file to s3
bun run utilities/s3.ts upload ./video.mp4 videos/output.mp4
```

### as library

```typescript
import { generateImage, imageToVideo } from "varg.ai-sdk"
import { uploadFromUrl } from "varg.ai-sdk"

// generate image
const img = await generateImage({
  prompt: "a beautiful sunset",
  model: "fal-ai/flux-pro/v1.1",
})

// animate it
const video = await imageToVideo({
  prompt: "camera pan across scene",
  imageUrl: img.data.images[0].url,
  duration: 5,
})

// upload to s3
const url = await uploadFromUrl(
  video.data.video.url,
  "videos/sunset.mp4"
)

console.log(`uploaded: ${url}`)
```

## modules

### lib
core libraries for video/audio processing:
- **ai-sdk/fal**: fal.ai using vercel ai sdk (recommended for images)
- **fal**: fal.ai using direct client (for video & advanced features)
- **higgsfield**: soul character generation
- **replicate**: replicate.com api (minimax, kling, luma, flux)
- **elevenlabs**: text-to-speech and voice generation
- **ffmpeg**: video editing operations (concat, trim, resize, etc.)

### service
high-level services combining multiple libs:
- **image**: image generation (fal + higgsfield)
- **video**: video generation from image/text
- **voice**: voice generation with multiple providers (elevenlabs)
- **sync**: lipsync workflows (wav2lip, audio overlay)

### utilities
- **s3**: cloudflare r2 / s3 storage operations

### pipeline
- **cookbooks**: step-by-step recipes for complex workflows
