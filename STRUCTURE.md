# sdk structure

## generated files

### lib/
- `fal.ts`: fal.ai wrapper with cli support
  - `image_to_video <prompt> <imageUrl> [duration]`
  - `text_to_video <prompt> [duration]`
  - `generate_image <prompt> [model]`

- `higgsfield.ts`: higgsfield soul wrapper with cli support
  - `generate_soul <prompt> [customReferenceId]`
  - `list_styles`
  - `create_character <name> <imageUrl1> [imageUrl2...]`
  - `get_character <id>`
  - `list_characters`

### service/
- `image.ts`: high-level image generation service
  - `fal <prompt> [model] [upload]`
  - `soul <prompt> [customReferenceId] [upload]`

- `video.ts`: high-level video generation service
  - `from_image <prompt> <imageUrl> [duration] [upload]`
  - `from_text <prompt> [duration] [upload]`

### utilities/
- `s3.ts`: cloudflare r2/s3 storage wrapper
  - `upload <filePath> <objectKey>`
  - `upload_from_url <url> <objectKey>`
  - `presigned_url <objectKey> [expiresIn]`

### pipeline/cookbooks/
- `talking-character.md`: step-by-step guide for creating talking character videos

### root
- `index.ts`: main export file for library usage
- `package.json`: dependencies (fal, higgsfield, aws-sdk)
- `README.md`: comprehensive usage docs
- `.env.example`: example environment variables

## usage patterns

### cli mode
```bash
bun run lib/fal.ts generate_image "sunset"
bun run service/video.ts from_text "ocean waves" 5 true
```

### library mode
```typescript
import { generateImage, imageToVideo } from "varg.ai-sdk"

const img = await generateImage({ prompt: "sunset" })
const vid = await imageToVideo({ prompt: "waves", imageUrl: img.url })
```

## dependencies installed
- @ai-sdk/fal
- @ai-sdk/replicate
- @higgsfield/client
- @aws-sdk/client-s3
- @aws-sdk/s3-request-presigner
- ai
