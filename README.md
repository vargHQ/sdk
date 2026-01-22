# varg

ai video generation sdk. jsx for videos, built on vercel ai sdk.

## quickstart

```bash
bun install vargai ai
```

set your api key:

```bash
export FAL_API_KEY=fal_xxx  # required
export ELEVENLABS_API_KEY=xxx  # optional, for voice/music
```

create `hello.tsx`:

```tsx
import { render, Render, Clip, Image, Video } from "vargai/react";
import { fal } from "vargai/ai";

const fruit = Image({
  prompt: "cute kawaii fluffy orange fruit character, round plush body, small black dot eyes, tiny smile, Pixar style",
  model: fal.imageModel("nano-banana-pro"),
  aspectRatio: "9:16",
});

await render(
  <Render width={1080} height={1920}>
    <Clip duration={3}>
      <Video
        prompt={{
          text: "character waves hello enthusiastically, bounces up and down, eyes squint with joy",
          images: [fruit],
        }}
        model={fal.videoModel("kling-v2.5")}
      />
    </Clip>
  </Render>,
  { output: "output/hello.mp4" }
);
```

run it:

```bash
bun run hello.tsx
```

## installation

```bash
# with bun (recommended)
bun install vargai ai

# with npm
npm install vargai ai
```

## ai sdk

varg extends vercel's ai sdk with video, music, and lipsync. use familiar patterns:

```typescript
import { generateImage } from "ai";
import { generateVideo, generateMusic, generateElement, scene, fal, elevenlabs } from "vargai/ai";

// generate image
const { image } = await generateImage({
  model: fal.imageModel("flux-schnell"),
  prompt: "cyberpunk cityscape at night",
  aspectRatio: "16:9",
});

// animate to video
const { video } = await generateVideo({
  model: fal.videoModel("kling-v2.5"),
  prompt: {
    images: [image.uint8Array],
    text: "camera slowly pans across the city",
  },
  duration: 5,
});

// generate music
const { audio } = await generateMusic({
  model: elevenlabs.musicModel(),
  prompt: "cyberpunk ambient music, electronic",
  duration: 10,
});

// save output
await Bun.write("output/city.mp4", video.uint8Array);
```

### character consistency with elements

create reusable elements for consistent generation across scenes:

```typescript
import { generateElement, scene, fal } from "vargai/ai";
import { generateImage, generateVideo } from "ai";

// create character from reference
const { element: character } = await generateElement({
  model: fal.imageModel("nano-banana-pro/edit"),
  type: "character",
  prompt: {
    text: "woman in her 30s, brown hair, green eyes",
    images: [referenceImageData],
  },
});

// use in scenes - same character every time
const { image: frame1 } = await generateImage({
  model: fal.imageModel("nano-banana-pro"),
  prompt: scene`${character} waves hello`,
});

const { image: frame2 } = await generateImage({
  model: fal.imageModel("nano-banana-pro"),
  prompt: scene`${character} gives thumbs up`,
});
```

### file handling

```typescript
import { File } from "vargai/ai";

// load from disk
const file = File.fromPath("media/portrait.jpg");

// load from url
const file = await File.fromUrl("https://example.com/video.mp4");

// load from buffer
const file = File.fromBuffer(uint8Array, "image/png");

// get contents
const buffer = await file.arrayBuffer();
const base64 = await file.base64();
```

## jsx / react

compose videos declaratively with jsx. everything is cached - same props = instant cache hit.

```tsx
import { render, Render, Clip, Image, Video, Music } from "vargai/react";
import { fal, elevenlabs } from "vargai/ai";

// kawaii fruit characters
const CHARACTERS = [
  { name: "orange", prompt: "cute kawaii fluffy orange fruit character, round plush body, Pixar style" },
  { name: "strawberry", prompt: "cute kawaii fluffy strawberry fruit character, round plush body, Pixar style" },
  { name: "lemon", prompt: "cute kawaii fluffy lemon fruit character, round plush body, Pixar style" },
];

const characterImages = CHARACTERS.map(char =>
  Image({
    prompt: char.prompt,
    model: fal.imageModel("nano-banana-pro"),
    aspectRatio: "9:16",
  })
);

await render(
  <Render width={1080} height={1920}>
    <Music prompt="cute baby song, playful xylophone, kawaii vibes" model={elevenlabs.musicModel()} />
    
    {CHARACTERS.map((char, i) => (
      <Clip key={char.name} duration={2.5}>
        <Video
          prompt={{
            text: "character waves hello, bounces up and down, eyes squint with joy",
            images: [characterImages[i]],
          }}
          model={fal.videoModel("kling-v2.5")}
        />
      </Clip>
    ))}
  </Render>,
  { output: "output/kawaii-fruits.mp4" }
);
```

### components

| component | purpose | key props |
|-----------|---------|-----------|
| `<Render>` | root container | `width`, `height`, `fps` |
| `<Clip>` | time segment | `duration`, `transition`, `cutFrom`, `cutTo` |
| `<Image>` | ai or static image | `prompt`, `src`, `model`, `zoom`, `aspectRatio`, `resize` |
| `<Video>` | ai or source video | `prompt`, `src`, `model`, `volume`, `cutFrom`, `cutTo` |
| `<Speech>` | text-to-speech | `voice`, `model`, `volume`, `children` |
| `<Music>` | background music | `prompt`, `src`, `model`, `volume`, `loop`, `ducking` |
| `<Title>` | text overlay | `position`, `color`, `start`, `end` |
| `<Subtitle>` | subtitle text | `backgroundColor` |
| `<Captions>` | auto-generated subs | `src`, `srt`, `style`, `color`, `activeColor` |
| `<Overlay>` | positioned layer | `left`, `top`, `width`, `height`, `keepAudio` |
| `<Split>` | side-by-side | `direction` |
| `<Slider>` | before/after reveal | `direction` |
| `<Swipe>` | tinder-style cards | `direction`, `interval` |
| `<TalkingHead>` | animated character | `character`, `src`, `voice`, `model`, `lipsyncModel` |
| `<Packshot>` | end card with cta | `background`, `logo`, `cta`, `blinkCta` |

### layout helpers

```tsx
import { Grid, SplitLayout } from "vargai/react";

// grid layout
<Grid columns={2}>
  <Video prompt="scene 1" />
  <Video prompt="scene 2" />
</Grid>

// split layout (before/after)
<SplitLayout left={beforeVideo} right={afterVideo} />
```

### transitions

67 gl-transitions available:

```tsx
<Clip transition={{ name: "fade", duration: 0.5 }}>
<Clip transition={{ name: "crossfade", duration: 0.5 }}>
<Clip transition={{ name: "wipeleft", duration: 0.5 }}>
<Clip transition={{ name: "cube", duration: 0.8 }}>
```

### caption styles

```tsx
<Captions src={voiceover} style="tiktok" />     // word-by-word highlight
<Captions src={voiceover} style="karaoke" />    // fill left-to-right
<Captions src={voiceover} style="bounce" />     // words bounce in
<Captions src={voiceover} style="typewriter" /> // typing effect
```

### talking head with lipsync

```tsx
import { render, Render, Clip, Image, Video, Speech, Captions, Music } from "vargai/react";
import { fal, elevenlabs, higgsfield } from "vargai/ai";

const voiceover = Speech({
  model: elevenlabs.speechModel("eleven_v3"),
  voice: "5l5f8iK3YPeGga21rQIX",
  children: "With varg, you can create any videos at scale!",
});

// base character with higgsfield soul (realistic)
const baseCharacter = Image({
  prompt: "beautiful East Asian woman, sleek black bob hair, fitted black t-shirt, iPhone selfie, minimalist bedroom",
  model: higgsfield.imageModel("soul", { styleId: higgsfield.styles.REALISTIC }),
  aspectRatio: "9:16",
});

// animate the character
const animatedCharacter = Video({
  prompt: {
    text: "woman speaking naturally, subtle head movements, friendly expression",
    images: [baseCharacter],
  },
  model: fal.videoModel("kling-v2.5"),
});

await render(
  <Render width={1080} height={1920}>
    <Music prompt="modern tech ambient, subtle electronic" model={elevenlabs.musicModel()} volume={0.1} />
    
    <Clip duration={5}>
      {/* lipsync: animated video + speech audio -> sync-v2 */}
      <Video
        prompt={{ video: animatedCharacter, audio: voiceover }}
        model={fal.videoModel("sync-v2-pro")}
      />
    </Clip>
    
    <Captions src={voiceover} style="tiktok" color="#ffffff" />
  </Render>,
  { output: "output/talking-head.mp4" }
);
```

### ugc transformation video

```tsx
import { render, Render, Clip, Image, Video, Speech, Captions, Music, Title, SplitLayout } from "vargai/react";
import { fal, elevenlabs, higgsfield } from "vargai/ai";

const CHARACTER = "woman in her 30s, brown hair, green eyes";

// before: generated with higgsfield soul
const beforeImage = Image({
  prompt: `${CHARACTER}, overweight, tired expression, loose grey t-shirt, bathroom mirror selfie`,
  model: higgsfield.imageModel("soul", { styleId: higgsfield.styles.REALISTIC }),
  aspectRatio: "9:16",
});

// after: edit with nano-banana-pro using before as reference
const afterImage = Image({
  prompt: { 
    text: `${CHARACTER}, fit slim, confident smile, fitted black tank top, same bathroom, same woman 40 pounds lighter`,
    images: [beforeImage] 
  },
  model: fal.imageModel("nano-banana-pro/edit"),
  aspectRatio: "9:16",
});

const beforeVideo = Video({
  prompt: { text: "woman looks down sadly, sighs, tired expression", images: [beforeImage] },
  model: fal.videoModel("kling-v2.5"),
});

const afterVideo = Video({
  prompt: { text: "woman smiles confidently, touches hair, proud expression", images: [afterImage] },
  model: fal.videoModel("kling-v2.5"),
});

const voiceover = Speech({
  model: elevenlabs.speechModel("eleven_multilingual_v2"),
  children: "With this technique I lost 40 pounds in just 3 months!",
});

await render(
  <Render width={1080 * 2} height={1920}>
    <Music prompt="upbeat motivational pop, inspiring transformation" model={elevenlabs.musicModel()} volume={0.15} />
    
    <Clip duration={5}>
      <SplitLayout direction="horizontal" left={beforeVideo} right={afterVideo} />
      <Title position="top" color="#ffffff">My 3-Month Transformation</Title>
    </Clip>
    
    <Captions src={voiceover} style="tiktok" color="#ffffff" />
  </Render>,
  { output: "output/transformation.mp4" }
);
```

### render options

```tsx
// save to file
await render(<Render>...</Render>, { output: "output/video.mp4" });

// with cache directory
await render(<Render>...</Render>, { 
  output: "output/video.mp4",
  cache: ".cache/ai"
});

// get buffer directly
const buffer = await render(<Render>...</Render>);
await Bun.write("video.mp4", buffer);
```

## studio

visual editor for video workflows. write code or use node-based interface.

```bash
bun run studio
# opens http://localhost:8282
```

features:
- monaco code editor with typescript support
- node graph visualization of workflow
- step-by-step execution with previews
- cache viewer for generated media

## skills

skills are multi-step workflows that combine actions into pipelines. located in `skills/` directory.

## supported providers

### fal (primary)

```typescript
import { fal } from "vargai/ai";

// image models
fal.imageModel("flux-schnell")          // fast generation
fal.imageModel("flux-pro")              // high quality
fal.imageModel("flux-dev")              // development
fal.imageModel("nano-banana-pro")       // versatile
fal.imageModel("nano-banana-pro/edit")  // image-to-image editing
fal.imageModel("recraft-v3")            // alternative

// video models
fal.videoModel("kling-v2.5")            // high quality video
fal.videoModel("kling-v2.1")            // previous version
fal.videoModel("wan-2.5")               // good for characters
fal.videoModel("minimax")               // alternative

// lipsync models
fal.videoModel("sync-v2")               // lip sync
fal.videoModel("sync-v2-pro")           // pro lip sync

// transcription
fal.transcriptionModel("whisper")
```

### elevenlabs

```typescript
import { elevenlabs } from "vargai/ai";

// speech models
elevenlabs.speechModel("eleven_turbo_v2")       // fast tts (default)
elevenlabs.speechModel("eleven_multilingual_v2") // multilingual

// music model
elevenlabs.musicModel()  // music generation

// available voices: rachel, adam, bella, josh, sam, antoni, elli, arnold, domi
```

### higgsfield

```typescript
import { higgsfield } from "vargai/ai";

// character-focused image generation with 100+ styles
higgsfield.imageModel("soul")
higgsfield.imageModel("soul", { 
  styleId: higgsfield.styles.REALISTIC,
  quality: "1080p"
})

// styles include: REALISTIC, ANIME, EDITORIAL_90S, Y2K, GRUNGE, etc.
```

### openai

```typescript
import { openai } from "vargai/ai";

// sora video generation
openai.videoModel("sora-2")
openai.videoModel("sora-2-pro")

// also supports all standard openai models via @ai-sdk/openai
```

### replicate

```typescript
import { replicate } from "vargai/ai";

// background removal
replicate.imageModel("851-labs/background-remover")

// any replicate model
replicate.imageModel("owner/model-name")
```

## supported models

### video generation

| model | provider | capabilities |
|-------|----------|--------------|
| kling-v2.5 | fal | text-to-video, image-to-video |
| kling-v2.1 | fal | text-to-video, image-to-video |
| wan-2.5 | fal | image-to-video, good for characters |
| minimax | fal | text-to-video, image-to-video |
| sora-2 | openai | text-to-video, image-to-video |
| sync-v2-pro | fal | lipsync (video + audio input) |

### image generation

| model | provider | capabilities |
|-------|----------|--------------|
| flux-schnell | fal | fast text-to-image |
| flux-pro | fal | high quality text-to-image |
| nano-banana-pro | fal | text-to-image, versatile |
| nano-banana-pro/edit | fal | image-to-image editing |
| recraft-v3 | fal | text-to-image |
| soul | higgsfield | character-focused, 100+ styles |

### audio

| model | provider | capabilities |
|-------|----------|--------------|
| eleven_turbo_v2 | elevenlabs | fast text-to-speech |
| eleven_multilingual_v2 | elevenlabs | multilingual tts |
| music_v1 | elevenlabs | text-to-music |
| whisper | fal | speech-to-text |

## environment variables

```bash
# required
FAL_API_KEY=fal_xxx

# optional - enable additional features
ELEVENLABS_API_KEY=xxx          # voice and music
REPLICATE_API_TOKEN=r8_xxx      # background removal, other models
OPENAI_API_KEY=sk_xxx           # sora video
HIGGSFIELD_API_KEY=hf_xxx       # soul character images
HIGGSFIELD_SECRET=secret_xxx
GROQ_API_KEY=gsk_xxx            # fast transcription

# storage (for upload)
CLOUDFLARE_R2_API_URL=https://xxx.r2.cloudflarestorage.com
CLOUDFLARE_ACCESS_KEY_ID=xxx
CLOUDFLARE_ACCESS_SECRET=xxx
CLOUDFLARE_R2_BUCKET=bucket-name
```

## cli

```bash
varg run image --prompt "sunset over mountains"
varg run video --prompt "ocean waves" --duration 5
varg run voice --text "Hello world" --voice rachel
varg list              # list all actions
varg studio            # open visual editor
```

## contributing

see [CONTRIBUTING.md](CONTRIBUTING.md) for development setup.

## license

Apache-2.0 — see [LICENSE.md](LICENSE.md)


