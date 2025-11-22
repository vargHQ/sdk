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
CLOUDFLARE_R2_API_URL=https://xxx.r2.cloudflarestorage.com
CLOUDFLARE_ACCESS_KEY_ID=xxx
CLOUDFLARE_ACCESS_SECRET=xxx
CLOUDFLARE_R2_BUCKET=m
```

## usage

### as cli

```bash
# generate image with fal
bun run lib/fal.ts generate_image "a beautiful sunset"

# generate soul character
bun run lib/higgsfield.ts generate_soul "professional headshot"

# create video from image
bun run service/video.ts from_image "person talking" https://example.com/image.jpg 5 true

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
- **fal**: serverless ai models (image/video generation)
- **higgsfield**: soul character generation

### service
high-level services combining multiple libs:
- **image**: image generation (fal + higgsfield)
- **video**: video generation from image/text

### utilities
- **s3**: cloudflare r2 / s3 storage operations

### pipeline
- **cookbooks**: step-by-step recipes for complex workflows
