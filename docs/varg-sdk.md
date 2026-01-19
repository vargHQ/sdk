# varg sdk

typescript sdk for ai video generation, built on vercel ai sdk patterns.

## installation

```bash
# core sdk
npm install @varg/sdk ai

# providers (install what you need)
npm install @varg/fal           # fal.ai (kling, nano-banana, lipsync)
npm install @varg/elevenlabs    # elevenlabs (tts, music)
npm install @varg/higgsfield    # higgsfield (soul, characters)
npm install @varg/heygen        # heygen (talking heads)
npm install @varg/openai        # openai (sora, gpt-image, dall-e)
npm install @varg/replicate     # replicate (birefnet, any model)
```

## quick start

```typescript
import { generateImage, generateVideo } from "ai";
import { fal } from "@varg/fal";

const { image } = await generateImage({
  model: fal.imageModel("nano-banana-pro"),
  prompt: "woman in red dress on beach at sunset",
  aspectRatio: "9:16",
});

const { video } = await generateVideo({
  model: fal.videoModel("kling-v2.5"),
  prompt: {
    images: [image.uint8Array],
    text: "woman walking along shoreline, hair blowing in wind",
  },
  duration: 5,
});
```

---

## core concepts

### files

load media from disk, urls, or buffers:

```typescript
import { File } from "@varg/sdk";

// from disk
const file = File.fromPath("media/portrait.jpg");

// from url
const file = await File.fromUrl("https://example.com/video.mp4");

// from buffer
const file = File.fromBuffer(uint8Array, "image/png");

// get contents
const buffer = await file.arrayBuffer();
const base64 = await file.base64();
```

### providers

each provider is a separate package:

```typescript
import { fal } from "@varg/fal";
import { elevenlabs } from "@varg/elevenlabs";
import { heygen } from "@varg/heygen";
import { higgsfield } from "@varg/higgsfield";
import { openai } from "@varg/openai";
import { replicate } from "@varg/replicate";
```

---

## image generation

### text to image

```typescript
import { generateImage } from "ai";
import { fal } from "@varg/fal";
import { higgsfield } from "@varg/higgsfield";

// fal nano-banana - options on model or in providerOptions
const { image } = await generateImage({
  model: fal.imageModel("nano-banana-pro", { resolution: "1K" }),
  prompt: "cyberpunk cityscape at night, neon lights",
  aspectRatio: "16:9",
  n: 1,
});

// higgsfield soul - options on model
const { image } = await generateImage({
  model: higgsfield.imageModel("soul", {
    style: "realism",
    enhancePrompt: true,
    quality: "1080p",
  }),
  prompt: "portrait of young woman, soft lighting",
  aspectRatio: "1:1",
});
```

### image to image (editing)

```typescript
const { image } = await generateImage({
  model: fal.imageModel("nano-banana-pro/edit"),
  prompt: {
    images: [referenceImage1, referenceImage2],
    text: "combine these two people in a coffee shop scene",
  },
  aspectRatio: "4:5",
});
```

### with element reference (characters, items, styles)

generate reusable elements for consistent generation:

```typescript
import { generateImage, generateVideo } from "ai";
import { generateElement, scene, File } from "@varg/sdk";
import { fal } from "@varg/fal";

// create character element
const { element: ralph } = await generateElement({
  model: fal.imageModel("nano-banana-pro/edit"),
  type: "character",
  prompt: {
    text: "ralph wiggum from the simpsons, yellow skin, blue shorts, red shirt",
    images: [await File.fromPath("media/ralph.jpg").arrayBuffer()],
  },
});
console.log(`ralph: ${ralph.images.length} images`);

// create item element
const { element: blackboard } = await generateElement({
  model: fal.imageModel("nano-banana-pro"),
  type: "item",
  prompt: "green chalkboard from simpsons intro, white chalk text",
});

// compose elements with scene`` tagged template
const { image: firstFrame } = await generateImage({
  model: fal.imageModel("nano-banana-pro/edit"),
  prompt: scene`${ralph} writes on the ${blackboard}`,
});

// use element.text in video prompts
const { video } = await generateVideo({
  model: fal.videoModel("wan-2.5"),
  prompt: {
    text: `${ralph.text} writes on the ${blackboard.text}`,
    images: [firstFrame.base64],
  },
  duration: 5,
});
```

element structure:
```typescript
interface Element {
  images: Uint8Array[];  // generated reference images
  text: string;          // text description for prompts
  type: "character" | "item" | "style";
}
```

---

## video generation

### image to video

```typescript
import { generateVideo } from "ai";
import { fal } from "@varg/fal";

const { video } = await generateVideo({
  model: fal.videoModel("kling-v2.5"),
  prompt: {
    images: [frameImage],
    text: "person slowly turns head and smiles",
  },
  duration: 5, // 5 or 10 seconds
});
```

### text to video

```typescript
const { video } = await generateVideo({
  model: fal.videoModel("kling-v2.5"),
  prompt: "aerial shot of ocean waves crashing on rocks",
  duration: 10,
});
```

### talking head from photo

```typescript
import { generateTalkingHead } from "@varg/sdk";
import { heygen } from "@varg/heygen";

const { video } = await generateTalkingHead({
  model: heygen.talkingHeadModel("avatar-iv"),
  image: File.fromPath("media/portrait.jpg"),
  script: "hello! welcome to our product demo.",
  voice: "rachel",
  motionPrompt: "friendly, subtle hand gestures",
});
```

---

## audio generation

### text to speech (voiceover)

```typescript
import { generateSpeech } from "ai";
import { elevenlabs } from "@varg/elevenlabs";

const { audio } = await generateSpeech({
  model: elevenlabs.speechModel("eleven-turbo-v2"),
  text: "this is an amazing new product that will change your life.",
  voice: "rachel",
  providerOptions: {
    elevenlabs: {
      stability: 0.5,
      similarityBoost: 0.75,
    },
  },
});

await Bun.write("output/voiceover.mp3", audio.uint8Array);
```

### music generation

```typescript
import { generateMusic } from "@varg/sdk";
import { elevenlabs } from "@varg/elevenlabs";

const { audio } = await generateMusic({
  model: elevenlabs.musicModel("sound-generation"),
  prompt: "upbeat electronic music, energetic, modern, 120 bpm",
  duration: 15, // up to 22 seconds
});
```

---

## lipsync

sync video to audio:

```typescript
import { generateLipsync } from "@varg/sdk";
import { fal } from "@varg/fal";

const { video } = await generateLipsync({
  model: fal.lipsyncModel("sync-v2-pro"),
  video: File.fromPath("media/talking-head.mp4"),
  audio: File.fromPath("media/voiceover.mp3"),
  syncMode: "cut_off", // "cut_off" | "loop" | "bounce" | "silence"
});
```

---

## video editing

use [editly](https://github.com/mifi/editly) directly for video composition. we provide `File.toTemp()` to bridge ai outputs to editly.

### bridging ai outputs to editly

```typescript
import editly from "editly";
import { generateVideo, generateImage } from "ai";
import { File } from "@varg/sdk";
import { fal } from "@varg/fal";

// generate with ai
const { video } = await generateVideo({
  model: fal.videoModel("kling-v2.5"),
  prompt: "woman walking on beach",
  duration: 5,
});

const { image } = await generateImage({
  model: fal.imageModel("nano-banana-pro"),
  prompt: "product shot on white background",
});

// save to temp files for editly
const videoPath = await File.toTemp(video);
const imagePath = await File.toTemp(image);

// use editly directly
await editly({
  outPath: "./output.mp4",
  width: 1080,
  height: 1920,
  clips: [
    {
      duration: 5,
      layers: [{ type: "video", path: videoPath, resizeMode: "contain-blur" }],
    },
    {
      duration: 3,
      transition: { name: "fade", duration: 0.5 },
      layers: [{ type: "image", path: imagePath }],
    },
  ],
  audioTracks: [
    { path: "./music.mp3", mixVolume: 0.3 },
  ],
  audioNorm: { enable: true },  // audio ducking
});
```

### editly features

- 67 gl-transitions (fade, crossfade, cube, pixelize, glitch, etc.)
- blur background resize (`resizeMode: "contain-blur"`)
- picture-in-picture (positioned overlays)
- audio mixing with ducking (`audioNorm`)
- ken burns on images (`zoomDirection: "in" | "out"`)
- custom canvas/fabric.js layers

see [editly docs](https://github.com/mifi/editly) for full api.

---

### add captions

```typescript
import { addCaptions } from "@varg/sdk";

// tiktok-style word-by-word captions
const { video } = await addCaptions({
  video: File.fromPath("media/video.mp4"),
  captions: [
    { text: "this is amazing", start: 0, end: 2 },
    { text: "watch until the end", start: 2, end: 4 },
  ],
  style: "tiktok", // animated bounce effect
  position: "center",
  font: {
    family: "Montserrat",
    size: 48,
    color: "#ffffff",
    strokeColor: "#000000",
    strokeWidth: 2,
  },
});
```

### add music to video

```typescript
import { addMusic } from "@varg/sdk";

const { video } = await addMusic({
  video: File.fromPath("media/video.mp4"),
  music: File.fromPath("media/background-music.mp3"),
  volume: 0.3,
  ducking: {
    enabled: true,
    threshold: -20, // duck when voice detected
    reduction: 0.2,
  },
});
```

### add voiceover to video

```typescript
import { addVoiceover } from "@varg/sdk";
import { elevenlabs } from "@varg/elevenlabs";

const { video } = await addVoiceover({
  video: File.fromPath("media/video.mp4"),
  text: "here's what you need to know about this amazing product",
  voice: elevenlabs.voice("rachel"),
  mixWithOriginal: false,
});
```

---

## video transformations

### resize with blur (aspect ratio conversion)

convert 9:16 to 4:5 with blurred sides:

```typescript
import { resizeVideo } from "@varg/sdk";

const { video } = await resizeVideo({
  video: File.fromPath("media/vertical-video.mp4"),
  targetAspect: "4:5", // "1:1" | "4:5" | "9:16" | "16:9" | "4:3" | "21:9"
  background: "blur", // blurred version of video fills sides
  blurStrength: 60,
});
```

### crop to aspect ratio

```typescript
import { cropVideo } from "@varg/sdk";

const { video } = await cropVideo({
  video: File.fromPath("media/landscape.mp4"),
  targetAspect: "9:16",
  gravity: "center", // "center" | "top" | "bottom" | "left" | "right"
});
```

### picture in picture

```typescript
import { createPiP } from "@varg/sdk";

const { video } = await createPiP({
  background: File.fromPath("media/background.mp4"),
  overlay: File.fromPath("media/speaker.mp4"),
  position: "bottom-right", // "bottom-right" | "bottom-left" | "top-right" | "top-left" | "center"
  size: 0.3, // 30% of frame
  padding: 20,
  borderRadius: 16,
});
```

---

## transitions & effects

### split screen (before/after)

```typescript
import { createSplitScreen } from "@varg/sdk";

const { video } = await createSplitScreen({
  left: File.fromPath("media/before.mp4"),
  right: File.fromPath("media/after.mp4"),
  style: "rounded", // "stretch" | "rounded"
  dividerWidth: 4,
  dividerColor: "#ffffff",
});
```

### before/after slider

animated slider revealing transformation:

```typescript
import { createSlider } from "@varg/sdk";

const { video } = await createSlider({
  before: File.fromPath("media/before.jpg"),
  after: File.fromPath("media/after.jpg"),
  direction: "left-to-right",
  duration: 4,
  style: "center-stop", // stops at 50%
  glowColor: [100, 255, 100],
});
```

### push transition

card-push transition between media:

```typescript
import { createPushTransition } from "@varg/sdk";

const { video } = await createPushTransition({
  before: File.fromPath("media/slide-1.jpg"),
  after: File.fromPath("media/slide-2.jpg"),
  direction: "left-to-right",
  duration: 3,
  parallax: true,
});
```

### tinder swipe

card swipe animation through multiple images:

```typescript
import { createSwipeAnimation } from "@varg/sdk";

const { video } = await createSwipeAnimation({
  images: [
    File.fromPath("media/card-1.jpg"),
    File.fromPath("media/card-2.jpg"),
    File.fromPath("media/card-3.jpg"),
  ],
  direction: "right",
  style: "stack", // "simple" | "stack" | "fade"
  durationPerSwipe: 0.8,
  pauseDuration: 0.5,
  cornerRadius: 20,
  shadow: true,
});
```

### slideshow with transitions

```typescript
import { createSlideshow } from "@varg/sdk";

const { video } = await createSlideshow({
  images: [
    File.fromPath("media/photo-1.jpg"),
    File.fromPath("media/photo-2.jpg"),
    File.fromPath("media/photo-3.jpg"),
  ],
  durationPerSlide: 3,
  transition: "crossfade", // "crossfade" | "fade" | "none"
  transitionDuration: 0.5,
  kenBurns: true, // subtle zoom/pan effect
});
```

### zoom effects

```typescript
import { applyZoom } from "@varg/sdk";

const { video } = await applyZoom({
  video: File.fromPath("media/video.mp4"),
  type: "in", // "in" | "out"
  intensity: 1.2, // 120% zoom
  easing: "ease-in-out",
});
```

---

## video composition

### concatenate videos

```typescript
import { concatenateVideos } from "@varg/sdk";

const { video } = await concatenateVideos({
  videos: [
    File.fromPath("media/intro.mp4"),
    File.fromPath("media/main.mp4"),
    File.fromPath("media/outro.mp4"),
  ],
  transition: "crossfade",
  transitionDuration: 0.5,
});
```

### create packshot (end card)

```typescript
import { createPackshot } from "@varg/sdk";

const { video } = await createPackshot({
  background: File.fromPath("media/product.jpg"),
  title: "shop now",
  subtitle: "limited time offer",
  ctaButton: {
    text: "buy now",
    color: "#ff0000",
    pulse: true,
  },
  duration: 3,
});
```

### composite (layered video)

```typescript
import { compositeVideos } from "@varg/sdk";

const { video } = await compositeVideos({
  layers: [
    { video: File.fromPath("media/background.mp4"), opacity: 1 },
    { video: File.fromPath("media/overlay.mp4"), opacity: 0.8, position: "center" },
    { video: File.fromPath("media/logo.png"), opacity: 1, position: "top-right", size: 0.1 },
  ],
});
```

---

## image processing

### remove background

```typescript
import { removeBackground } from "@varg/sdk";
import { replicate } from "@varg/replicate";

const { image } = await removeBackground({
  model: replicate.imageModel("birefnet"),
  image: File.fromPath("media/portrait.jpg"),
});
```

---

## complete pipeline example

full video ad creation:

```typescript
import { generateImage, generateVideo, generateSpeech } from "ai";
import {
  generateMusic,
  addCaptions,
  addMusic,
  addVoiceover,
  resizeVideo,
  createPackshot,
  concatenateVideos,
  File,
} from "@varg/sdk";
import { fal } from "@varg/fal";
import { elevenlabs } from "@varg/elevenlabs";
import { higgsfield } from "@varg/higgsfield";

async function createVideoAd() {
  // 1. generate character image
  const { image: characterImage } = await generateImage({
    model: higgsfield.imageModel("soul"),
    prompt: "confident woman in her 30s, natural makeup, warm smile",
    aspectRatio: "9:16",
  });

  // 2. animate to video
  const { video: mainVideo } = await generateVideo({
    model: fal.videoModel("kling-v2.5"),
    prompt: {
      images: [characterImage.uint8Array],
      text: "woman speaking to camera, friendly gestures, nodding",
    },
    duration: 10,
  });

  // 3. generate voiceover
  const { audio: voiceover } = await generateSpeech({
    model: elevenlabs.speechModel("eleven-turbo-v2"),
    text: "discover the secret to radiant skin with our new formula",
    voice: "rachel",
  });

  // 4. generate background music
  const { audio: music } = await generateMusic({
    model: elevenlabs.musicModel("sound-generation"),
    prompt: "soft inspiring background music, gentle piano",
    duration: 15,
  });

  // 5. add voiceover with captions
  let { video } = await addVoiceover({
    video: mainVideo,
    audio: voiceover,
  });

  ({ video } = await addCaptions({
    video,
    captions: [
      { text: "discover the secret", start: 0, end: 2 },
      { text: "to radiant skin", start: 2, end: 4 },
      { text: "with our new formula", start: 4, end: 6 },
    ],
    style: "tiktok",
  }));

  // 6. add background music with ducking
  ({ video } = await addMusic({
    video,
    music,
    volume: 0.2,
    ducking: { enabled: true },
  }));

  // 7. create packshot
  const { video: packshot } = await createPackshot({
    background: File.fromPath("media/product.jpg"),
    title: "shop now",
    ctaButton: { text: "buy now", pulse: true },
    duration: 3,
  });

  // 8. concatenate main video + packshot
  const { video: finalVideo } = await concatenateVideos({
    videos: [video, packshot],
    transition: "crossfade",
  });

  // 9. export multiple aspect ratios
  const { video: video_9x16 } = finalVideo; // already 9:16

  const { video: video_4x5 } = await resizeVideo({
    video: finalVideo,
    targetAspect: "4:5",
    background: "blur",
  });

  const { video: video_1x1 } = await resizeVideo({
    video: finalVideo,
    targetAspect: "1:1",
    background: "blur",
  });

  // save all formats
  await Bun.write("output/ad_9x16.mp4", video_9x16.uint8Array);
  await Bun.write("output/ad_4x5.mp4", video_4x5.uint8Array);
  await Bun.write("output/ad_1x1.mp4", video_1x1.uint8Array);

  console.log("done! exported 3 formats");
}

createVideoAd();
```

---

## provider reference

### fal

| model type | models |
|---|---|
| `imageModel` | `nano-banana-pro`, `nano-banana-pro/edit` |
| `videoModel` | `kling-v2.5`, `kling-v2.5-pro` |
| `lipsyncModel` | `sync-v2-pro` |

### higgsfield

| model type | models |
|---|---|
| `imageModel` | `soul` |

### elevenlabs

| model type | models |
|---|---|
| `speechModel` | `eleven-turbo-v2`, `eleven-multilingual-v2` |
| `musicModel` | `sound-generation` |
| `voice` | `rachel`, `adam`, `bella`, ... |

### heygen

| model type | models |
|---|---|
| `talkingHeadModel` | `avatar-iv` |

### openai

| model type | models |
|---|---|
| `imageModel` | `gpt-image-1`, `dall-e-3`, `dall-e-2` |
| `videoModel` | `sora-2`, `sora-2-pro` |

### replicate

| model type | models |
|---|---|
| `imageModel` | `birefnet` (background removal), any replicate model |

---

## types

```typescript
interface File {
  arrayBuffer(): Promise<ArrayBuffer>;
  base64(): Promise<string>;
  uint8Array: Uint8Array;
  mimeType: string;
}

interface GenerateImageResult {
  image: File;
  revisedPrompt?: string;
}

interface GenerateVideoResult {
  video: File;
  duration: number;
}

interface GenerateSpeechResult {
  audio: File;
  duration: number;
}

type AspectRatio = "1:1" | "4:5" | "9:16" | "16:9" | "4:3" | "21:9" | "3:2" | "2:3";

type CaptionStyle = "tiktok" | "subtitle" | "minimal";

type TransitionType = "crossfade" | "fade" | "none";
```
