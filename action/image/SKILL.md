---
name: image-generation
description: generate ai images using fal (flux models) or higgsfield soul characters. use when user wants to create images, headshots, character portraits, or needs image generation with specific models.
allowed-tools: Read, Bash
---

# image generation

generate ai images using multiple providers with automatic s3 upload support.

## providers

### fal (flux models)
- high quality image generation
- supports flux-pro, flux-dev, and other flux models
- configurable model selection
- automatic image opening on generation

### higgsfield soul
- character headshot generation
- consistent character style
- professional portrait quality
- custom style references

## usage

### generate with fal
```bash
bun run service/image.ts fal "a beautiful sunset over mountains" [model] [upload]
```

**parameters:**
- `prompt` (required): text description of the image
- `model` (optional): fal model to use (default: flux-pro)
- `upload` (optional): "true" to upload to s3

**example:**
```bash
bun run service/image.ts fal "professional headshot, studio lighting" true
```

### generate with soul
```bash
bun run service/image.ts soul "friendly person smiling" [styleId] [upload]
```

**parameters:**
- `prompt` (required): character description
- `styleId` (optional): custom higgsfield style reference
- `upload` (optional): "true" to upload to s3

**example:**
```bash
bun run service/image.ts soul "professional business woman" true
```

## as library

```typescript
import { generateWithFal, generateWithSoul } from "./service/image"

// fal generation
const falResult = await generateWithFal("sunset over ocean", {
  model: "fal-ai/flux-pro/v1.1",
  upload: true
})
console.log(falResult.imageUrl)
console.log(falResult.uploaded) // s3 url if upload=true

// soul generation
const soulResult = await generateWithSoul("friendly character", {
  upload: true
})
console.log(soulResult.imageUrl)
```

## output

returns `ImageGenerationResult`:
```typescript
{
  imageUrl: string,      // direct image url
  uploaded?: string      // s3 url if upload requested
}
```

## when to use

use this skill when:
- generating images from text descriptions
- creating character headshots or portraits
- need consistent character style (use soul)
- need high quality photorealistic images (use fal)
- preparing images for video generation pipeline

## nsfw filtering and content moderation

fal.ai has content safety filters that may flag images as nsfw:

**common triggers:**
- prompts mentioning "athletic wear", "fitted sportswear", "gym clothes"
- certain body descriptions even when clothed
- prompts that could be interpreted as revealing clothing

**symptoms:**
- image generation returns but file is empty (often 7.6KB)
- no error message, just an unusable file
- happens inconsistently across similar prompts

**solutions:**
- specify modest, full-coverage clothing explicitly:
  - ✅ "long sleeve athletic top and full length leggings"
  - ✅ "fully covered in modest workout attire"
  - ❌ "athletic wear" (too vague, may trigger filter)
  - ❌ "fitted sportswear" (may trigger filter)
- add "professional", "modest", "appropriate" to descriptions
- if multiple images in batch get flagged, adjust prompts to be more explicit about coverage
- always check output file sizes - empty files (< 10KB) indicate nsfw filtering

**example:**
```bash
# ❌ may get flagged as nsfw
bun run service/image.ts fal "woman in athletic wear"

# ✅ less likely to trigger filter
bun run service/image.ts fal "woman wearing long sleeve athletic top and full length leggings"
```

## environment variables

required:
- `FAL_API_KEY` - for fal image generation
- `HIGGSFIELD_API_KEY` - for soul character generation
- `HIGGSFIELD_SECRET` - for higgsfield authentication

optional (for s3 upload):
- `CLOUDFLARE_R2_API_URL`
- `CLOUDFLARE_ACCESS_KEY_ID`
- `CLOUDFLARE_ACCESS_SECRET`
- `CLOUDFLARE_R2_BUCKET`
