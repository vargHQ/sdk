---
name: video-generation
description: generate videos from images or text prompts using fal.ai. use when user wants to animate images, create videos from text, or needs ai video generation with 5-10 second clips.
allowed-tools: Read, Bash
---

# video generation

generate ai videos from images or text using fal.ai with automatic s3 upload support.

## capabilities

- **image-to-video**: animate static images with motion prompts
- **text-to-video**: generate videos directly from text descriptions
- supports 5 or 10 second duration
- automatic s3 upload

## usage

### generate from image
```bash
bun run service/video.ts from_image <prompt> <imageUrl> [duration] [upload]
```

**parameters:**
- `prompt` (required): motion description (e.g., "camera pan left")
- `imageUrl` (required): url of the source image
- `duration` (optional): 5 or 10 seconds (default: 5)
- `upload` (optional): "true" to upload to s3

**example:**
```bash
bun run service/video.ts from_image "person talking naturally" https://example.com/headshot.jpg 5 true
```

### generate from text
```bash
bun run service/video.ts from_text <prompt> [duration] [upload]
```

**parameters:**
- `prompt` (required): video scene description
- `duration` (optional): 5 or 10 seconds (default: 5)
- `upload` (optional): "true" to upload to s3

**example:**
```bash
bun run service/video.ts from_text "waves crashing on beach at sunset" 10 true
```

## as library

```typescript
import { generateVideoFromImage, generateVideoFromText } from "./service/video"

// animate an image
const videoResult = await generateVideoFromImage(
  "camera zoom in slowly",
  "https://example.com/portrait.jpg",
  { duration: 5, upload: true }
)
console.log(videoResult.videoUrl)
console.log(videoResult.uploaded) // s3 url if upload=true

// generate from text
const textVideo = await generateVideoFromText(
  "forest path with sunlight filtering through trees",
  { duration: 10, upload: true }
)
```

## output

returns `VideoGenerationResult`:
```typescript
{
  videoUrl: string,      // direct video url
  duration?: number,     // actual video duration
  uploaded?: string      // s3 url if upload requested
}
```

## when to use

use this skill when:
- animating character headshots or portraits
- creating motion from static images
- generating video clips from text descriptions
- preparing videos for lipsync or editing pipeline
- need short form video content (5-10s)

## tips

**for character animation:**
- use subtle prompts like "person talking naturally" or "slight head movement"
- keep duration at 5 seconds for character shots
- combine with lipsync for talking videos

**for scene generation:**
- be descriptive about camera movement and scene dynamics
- 10 seconds works better for landscape/scene videos

## environment variables

required:
- `FAL_API_KEY` - for fal video generation

optional (for s3 upload):
- `CLOUDFLARE_R2_API_URL`
- `CLOUDFLARE_ACCESS_KEY_ID`
- `CLOUDFLARE_ACCESS_SECRET`
- `CLOUDFLARE_R2_BUCKET`

## generation time

expect 2-3 minutes per video clip
