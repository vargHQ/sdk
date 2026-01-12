# @varg/sdk - TypeScript AI SDK Prototype

A clean, composable API for AI video generation, inspired by Vercel AI SDK.

## Installation

```bash
npm install @varg/sdk
```

## Quick Start

```typescript
import {
  generateImage,
  animateImage,
  generateSpeech,
  generateLipSyncVideo,
  fal,
  higgsfield,
  elevenlabs,
} from '@varg/sdk';

async function main() {
  // Define models
  const higgsfieldSoul = higgsfield.image('higgsfield/soul');
  const klingImage2Video = fal.video('fal-ai/kling-video/v2.5-turbo/pro/image-to-video');
  const elevenLabs = elevenlabs.speech('eleven_multilingual_v2');
  const lypsync = fal.lipsync();

  // 1. Generate image
  const { image } = await generateImage({
    model: higgsfieldSoul,
    prompt: 'A young woman smiling at camera, natural lighting',
    aspectRatio: '9:16',
    providerOptions: {
      style_id: '1cb4b936-77bf-4f9a-9039-f3d349a4cdbe', // realistic
    },
  });

  // 2. Animate to video
  const { video } = await animateImage({
    model: klingImage2Video,
    image,
    prompt: 'Person speaking naturally, subtle movements',
    duration: 5,
    providerOptions: {
      cfg_scale: 0.5,
    },
  });

  // 3. Generate speech
  const { speech } = await generateSpeech({
    model: elevenLabs,
    text: 'I use varg.ai SDK to generate realistic videos.',
    providerOptions: {
      voice: 'kPzsL2i3teMYv0FxEYQ6',
    },
  });

  // 4. Apply lipsync
  const { video: lipsyncedVideo } = await generateLipSyncVideo({
    model: lypsync,
    video,
    audio: speech,
  });

  console.log('Final video:', lipsyncedVideo.url);
}
```

## Providers

### Higgsfield

Character/portrait generation with photorealistic quality.

```typescript
import { higgsfield } from '@varg/sdk';

const soul = higgsfield.image('soul');
// or with shortcut
const soul = higgsfield.image('higgsfield/soul');
```

### Fal.ai

Video generation, lipsync, and various image models.

```typescript
import { fal } from '@varg/sdk';

// Image models
const flux = fal.image('flux-pro');
const nanoBanana = fal.image('nano-banana');

// Video models (Kling)
const kling = fal.video('kling');
const klingStandard = fal.video('kling-standard');

// Lipsync
const lipsync = fal.lipsync();
```

### ElevenLabs

Text-to-speech with natural voices.

```typescript
import { elevenlabs, getVoiceId } from '@varg/sdk';

const voice = elevenlabs.speech('multilingual_v2');

// With voice preset
await generateSpeech({
  model: voice,
  text: 'Hello world!',
  providerOptions: {
    voice: getVoiceId('matilda'), // or direct voice ID
    stability: 0.6,
  },
});
```

### HeyGen

Direct talking head generation (photo → video in one step).

```typescript
import { heygen } from '@varg/sdk';
import { generateTalkingHead } from '@varg/sdk';

const model = heygen.talkingHead();

const { video } = await generateTalkingHead({
  model,
  image: 'https://example.com/photo.jpg',
  script: 'Hello, I am your AI assistant!',
  voice: 'en-US-1',
});
```

## Batch Processing

For generating multiple creatives (campaign workflow):

```typescript
import { generateImage, animateImage, generateSpeech, generateLipSyncVideo } from '@varg/sdk';

interface Character {
  id: number;
  name: string;
  prompt: string;
  voice: string;
  script: string;
}

async function generateCharacter(char: Character) {
  const { image } = await generateImage({ /* ... */ });
  const { video } = await animateImage({ /* ... */ });
  const { speech } = await generateSpeech({ /* ... */ });
  const { video: final } = await generateLipSyncVideo({ /* ... */ });
  return final;
}

// Process in batches
const BATCH_SIZE = 3;
for (let i = 0; i < characters.length; i += BATCH_SIZE) {
  const batch = characters.slice(i, i + BATCH_SIZE);
  const results = await Promise.all(batch.map(generateCharacter));

  // Wait between batches (rate limits)
  await new Promise(r => setTimeout(r, 5000));
}
```

## API Reference

### `generateImage(options)`

Generate an image from text prompt.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `model` | `ModelRef` | Yes | Model reference from provider |
| `prompt` | `string` | Yes | Image description |
| `aspectRatio` | `string` | No | `'9:16'`, `'16:9'`, `'1:1'`, `'4:5'` |
| `providerOptions` | `object` | No | Provider-specific options |

Returns: `{ image: ImageObject }`

### `animateImage(options)`

Animate an image to create video.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `model` | `ModelRef` | Yes | Video model reference |
| `image` | `ImageObject \| string` | Yes | Image to animate |
| `prompt` | `string` | Yes | Animation description |
| `duration` | `number` | No | Duration in seconds (default: 5) |
| `providerOptions` | `object` | No | Provider-specific options |

Returns: `{ video: VideoObject }`

### `generateSpeech(options)`

Generate speech from text.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `model` | `ModelRef` | Yes | Speech model reference |
| `text` | `string` | Yes | Text to speak |
| `providerOptions` | `object` | No | Voice ID, stability, style, etc. |

Returns: `{ speech: AudioObject }`

### `generateLipSyncVideo(options)`

Apply lipsync to video with audio.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `model` | `ModelRef` | Yes | Lipsync model reference |
| `video` | `VideoObject \| string` | Yes | Video to lipsync |
| `audio` | `AudioObject \| string` | Yes | Audio to sync |
| `syncMode` | `string` | No | `'cut_off'`, `'loop'`, `'remap'` |

Returns: `{ video: VideoObject }`

## Files

- `index.ts` - Main exports
- `providers.ts` - Provider definitions (fal, higgsfield, elevenlabs, heygen)
- `core.ts` - Generation functions
- `basic.ts` - Basic example
- `campaign.ts` - Batch campaign example

## License

MIT
