# sdk structure

## lib/ - two fal implementations

### lib/ai-sdk/fal.ts
uses `@ai-sdk/fal` with vercel ai sdk

**when to use:**
- standard image generation
- need consistent api across providers
- want automatic image format handling
- prefer typed aspect ratios

**commands:**
```bash
bun run lib/ai-sdk/fal.ts generate_image <prompt> [model] [aspectRatio]
```

### lib/fal.ts
uses `@fal-ai/client` directly

**when to use:**
- video generation (image-to-video, text-to-video)
- advanced fal features
- need queue/streaming updates
- custom api parameters

**commands:**
```bash
bun run lib/fal.ts generate_image <prompt> [model] [imageSize]
bun run lib/fal.ts image_to_video <prompt> <imageUrl> [duration]
bun run lib/fal.ts text_to_video <prompt> [duration]
```

### lib/higgsfield.ts
uses `@higgsfield/client` for soul character generation

**commands:**
```bash
bun run lib/higgsfield.ts generate_soul <prompt> [customReferenceId]
bun run lib/higgsfield.ts create_character <name> <imageUrl1> [imageUrl2...]
bun run lib/higgsfield.ts list_styles
```

## service/ - high-level wrappers

### service/image.ts
combines fal + higgsfield for image generation

```bash
bun run service/image.ts fal <prompt> [model] [upload]
bun run service/image.ts soul <prompt> [customReferenceId] [upload]
```

### service/video.ts
video generation with optional s3 upload

```bash
bun run service/video.ts from_image <prompt> <imageUrl> [duration] [upload]
bun run service/video.ts from_text <prompt> [duration] [upload]
```

## utilities/

### utilities/s3.ts
cloudflare r2 / s3 storage operations

```bash
bun run utilities/s3.ts upload <filePath> <objectKey>
bun run utilities/s3.ts upload_from_url <url> <objectKey>
bun run utilities/s3.ts presigned_url <objectKey> [expiresIn]
```

## pipeline/cookbooks/
markdown guides for complex workflows

- `talking-character.md`: create talking character videos

## dependencies

- `@ai-sdk/fal` - vercel ai sdk fal provider
- `@fal-ai/client` - official fal client
- `@higgsfield/client` - higgsfield api client
- `@aws-sdk/client-s3` - s3 storage
- `ai` - vercel ai sdk core

## key decisions

1. **two fal implementations** - ai-sdk for simplicity, client for power
2. **all scripts are cli + library** - can be run directly or imported
3. **consistent logging** - `[module] message` format
4. **auto image opening** - ai-sdk version opens images automatically
