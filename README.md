# varg.ai sdk

video generation and editing tools sdk

## folder structure

```
sdk/
│
├── media/              # working directory for media files (images, videos, audio)
├── output/             # generated output files
│
├── utilities/
│
├── lib/
│   ├── pymovie/
│   ├── opencv/
│   ├── fal/
│   ├── higgsfield/
│   ├── ffmpeg/
│   ├── remotion/
│   ├── remotion.dev/
│   └── motion.dev/
│
├── service/
│   ├── image/          # image generation + SKILL.md
│   ├── video/          # video generation + SKILL.md
│   ├── voice/          # voice synthesis + SKILL.md
│   ├── sync/           # lipsync + SKILL.md
│   ├── captions/       # video captions + SKILL.md
│   ├── edit/           # video editing + SKILL.md
│   └── transcribe/     # audio transcription + SKILL.md
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
GROQ_API_KEY=gsk_xxx
FIREWORKS_API_KEY=fw_xxx
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

# generate video from image (supports local files)
bun run lib/fal.ts image_to_video "person talking" media/image.jpg 5
bun run lib/fal.ts image_to_video "person talking" https://example.com/image.jpg 5

# generate soul character
bun run lib/higgsfield.ts generate_soul "professional headshot"

# generate video with replicate
bun run lib/replicate.ts minimax "person walking on beach"

# generate voice with elevenlabs
bun run lib/elevenlabs.ts tts "hello world" rachel output.mp3

# transcribe audio to text/subtitles
bun run service/transcribe media/audio.mp3 groq
bun run service/transcribe media/audio.mp3 fireworks output.srt
bun run lib/fireworks.ts media/audio.mp3 output.srt

# edit video with ffmpeg
bun run lib/ffmpeg.ts concat output.mp4 video1.mp4 video2.mp4

# lipsync video with audio
bun run service/sync overlay video.mp4 audio.mp3 synced.mp4

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
core libraries for video/audio/ai processing:
- **ai-sdk/fal**: fal.ai using vercel ai sdk (recommended for images)
- **ai-sdk/replicate**: replicate.com using vercel ai sdk
- **fal**: fal.ai using direct client (for video & advanced features, supports local file uploads)
- **higgsfield**: soul character generation
- **replicate**: replicate.com api (minimax, kling, luma, flux)
- **elevenlabs**: text-to-speech and voice generation
- **groq**: ultra-fast whisper transcription (audio to text)
- **fireworks**: word-level audio transcription with timestamps (srt/vtt)
- **ffmpeg**: video editing operations (concat, trim, resize, etc.)
- **remotion**: programmatic video creation with react

### media folder
- **media/**: working directory for storing input media files (images, videos, audio)
- **output/**: directory for generated/processed output files
- use `media/` for source files, `output/` for results
- fal.ts supports local file paths from `media/` folder

### service
high-level services combining multiple libs. each service includes a SKILL.md for claude code agent skills:
- **image**: image generation (fal + higgsfield)
- **video**: video generation from image/text
- **voice**: voice generation with multiple providers (elevenlabs)
- **transcribe**: audio transcription with groq whisper or fireworks (srt support)
- **sync**: lipsync workflows (wav2lip, audio overlay)
- **captions**: auto-generate and overlay subtitles on videos
- **edit**: video editing workflows (resize, trim, concat, social media prep)

### utilities
- **s3**: cloudflare r2 / s3 storage operations

### pipeline
- **cookbooks**: step-by-step recipes for complex workflows (includes talking-character SKILL.md)

## key learnings

### remotion batch rendering with variations
when creating multiple video variations (e.g., 15 videos with different images):

**❌ don't do this:**
```bash
# overwriting files causes caching issues
for i in 1..15; do
  cp woman-$i-before.jpg lib/remotion/public/before.jpg  # overwrites!
  cp woman-$i-after.jpg lib/remotion/public/after.jpg    # overwrites!
  render video
done
# result: all videos show the same woman (the last one)
```

**✅ do this instead:**
```typescript
// 1. use unique filenames for each variation
// lib/remotion/public/woman-01-before.jpg, woman-02-before.jpg, etc.

// 2. pass variation id as prop
interface Props { variationId?: string }
const MyComp: React.FC<Props> = ({ variationId = "01" }) => {
  const beforeImg = staticFile(`woman-${variationId}-before.jpg`);
  const afterImg = staticFile(`woman-${variationId}-after.jpg`);
}

// 3. register multiple compositions with unique props
registerRoot(() => (
  <>
    {Array.from({ length: 15 }, (_, i) => {
      const variationId = String(i + 1).padStart(2, "0");
      return (
        <Composition
          id={`MyVideo-${variationId}`}
          component={MyComp}
          defaultProps={{ variationId }}
          {...otherProps}
        />
      );
    })}
  </>
));

// 4. render each composition
bun run lib/remotion/index.ts render root.tsx MyVideo-01 output-01.mp4
bun run lib/remotion/index.ts render root.tsx MyVideo-02 output-02.mp4
```

**why this matters:**
- remotion's `staticFile()` caches based on filename
- overwriting files between renders causes all videos to use the last cached version
- unique filenames + props ensure each render uses correct assets

### fal.ai nsfw content filtering
fal.ai automatically filters content that may be nsfw:

**symptoms:**
- image generation succeeds but returns empty file (~7.6KB)
- no error message
- happens with certain clothing/body descriptions

**solution:**
- be explicit about modest, full-coverage clothing:
  - ✅ "long sleeve athletic top and full length leggings"
  - ❌ "athletic wear" (vague, may trigger filter)
- add "professional", "modest", "appropriate" to prompts
- always check file sizes after batch generation (< 10KB = filtered)


## License

Copyright © 2025 vargai Inc. and contributors  
Licensed under the Apache License, Version 2.0.
See the [LICENSE](./LICENSE) file for details.