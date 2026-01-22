---
name: varg-video-generation
description: Generate AI videos using varg SDK React engine. Use when creating videos, animations, talking characters, slideshows, or social media content.
license: MIT
metadata:
  author: vargHQ
  version: "1.0.0"
compatibility: Requires bun runtime. FAL_KEY required. Optional ELEVENLABS_API_KEY, REPLICATE_API_TOKEN, GROQ_API_KEY
allowed-tools: Bash(bun:*) Bash(cat:*) Read Write Edit
---

# Video Generation with varg React Engine

Generate AI videos using declarative JSX syntax with automatic caching and parallel generation.

## Quick Setup

Initialize a new project:

```bash
bunx vargai init
```

Or just create hello.tsx starter:

```bash
bunx vargai hello
```

Check existing API keys:

```bash
cat .env 2>/dev/null | grep -E "^(FAL_KEY|ELEVENLABS_API_KEY)=" || echo "No API keys found"
```

## Required API Keys

### FAL_KEY (Required)

| Detail | Value |
|--------|-------|
| Provider | Fal.ai |
| Get it | https://fal.ai/dashboard/keys |
| Free tier | Yes (limited credits) |
| Used for | Image generation (Flux), Video generation (Wan 2.5, Kling) |

If user doesn't have `FAL_KEY`:
1. Direct them to https://fal.ai/dashboard/keys
2. Create account and generate API key
3. Add to `.env` file: `FAL_KEY=fal_xxxxx`

### Optional Keys

| Feature | Key | Provider | URL |
|---------|-----|----------|-----|
| Music/Voice | `ELEVENLABS_API_KEY` | ElevenLabs | https://elevenlabs.io/app/settings/api-keys |
| Lipsync | `REPLICATE_API_TOKEN` | Replicate | https://replicate.com/account/api-tokens |
| Transcription | `GROQ_API_KEY` | Groq | https://console.groq.com/keys |

**Warn user about missing optional keys but continue with available features.**

## Available Features by API Key

**FAL_API_KEY only:**
- Image generation (Flux models)
- Image-to-video animation (Wan 2.5, Kling)
- Text-to-video generation
- Slideshows with transitions
- Ken Burns zoom effects

**FAL + ELEVENLABS:**
- All above, plus:
- AI-generated background music
- Text-to-speech voiceovers
- Talking character videos

**All keys:**
- Full production pipeline with lipsync and auto-captions

## Quick Templates

### Simple Slideshow (FAL only)

```tsx
/** @jsxImportSource vargai */
import { Render, Clip, Image } from "vargai/react";

const SCENES = ["sunset over ocean", "mountain peaks", "city at night"];

export default (
  <Render width={1080} height={1920}>
    {SCENES.map((prompt, i) => (
      <Clip key={i} duration={3} transition={{ name: "fade", duration: 0.5 }}>
        <Image prompt={prompt} zoom="in" />
      </Clip>
    ))}
  </Render>
);
```

### Animated Video (FAL + ElevenLabs)

```tsx
/** @jsxImportSource vargai */
import { Render, Clip, Image, Video, Music } from "vargai/react";
import { fal, elevenlabs } from "vargai/ai";

const cat = Image({ prompt: "cute cat on windowsill" });

export default (
  <Render width={1080} height={1920}>
    <Music prompt="upbeat electronic" model={elevenlabs.musicModel()} />
    <Clip duration={5}>
      <Video
        prompt={{ text: "cat turns head, blinks slowly", images: [cat] }}
        model={fal.videoModel("wan-2.5")}
      />
    </Clip>
  </Render>
);
```

### Talking Character

```tsx
/** @jsxImportSource vargai */
import { Render, Clip, Image, Video, Speech, Captions } from "vargai/react";
import { fal, elevenlabs } from "vargai/ai";

const robot = Image({ prompt: "friendly robot, blue metallic", aspectRatio: "9:16" });

const voiceover = Speech({
  model: elevenlabs.speechModel("eleven_multilingual_v2"),
  voice: "adam",
  children: "Hello! I'm your AI assistant. Let's create something amazing!",
});

export default (
  <Render width={1080} height={1920}>
    <Clip duration={5}>
      <Video
        prompt={{ text: "robot talking, subtle head movements", images: [robot] }}
        model={fal.videoModel("wan-2.5")}
      />
    </Clip>
    <Captions src={voiceover} style="tiktok" />
  </Render>
);
```



## Running Videos

```bash
bunx vargai render your-video.tsx
```

## Key Components

| Component | Purpose | Required Key |
|-----------|---------|--------------|
| `<Render>` | Root container | - |
| `<Clip>` | Sequential segment | - |
| `<Image>` | AI image | FAL |
| `<Animate>` | Image-to-video | FAL |
| `<Music>` | Background music | ElevenLabs |
| `<Speech>` | Text-to-speech | ElevenLabs |

## Common Patterns

### Character Consistency

```tsx
const character = Image({ prompt: "blue robot" });
// Reuse same reference = same generated image
<Animate image={character} motion="waving" />
<Animate image={character} motion="dancing" />
```

### Transitions

```tsx
<Clip transition={{ name: "fade", duration: 0.5 }}>
// Options: fade, crossfade, wipeleft, cube, slideup, etc.
```

### Aspect Ratios

- `9:16` - TikTok, Reels, Shorts (vertical)
- `16:9` - YouTube (horizontal)
- `1:1` - Instagram (square)

### Zoom Effects

```tsx
<Image prompt="landscape" zoom="in" />   // Zoom in
<Image prompt="landscape" zoom="out" />  // Zoom out
<Image prompt="landscape" zoom="left" /> // Pan left
```

## Troubleshooting

### "FAL_KEY not found"
- Check `.env` file exists in project root
- Ensure no spaces around `=` sign
- Restart terminal after adding keys

### "Rate limit exceeded"
- Free tier has limited credits
- Wait or upgrade plan
- Use caching to avoid regenerating

### "Video generation failed"
- Check prompt doesn't violate content policy
- Try simpler motion descriptions
- Reduce video duration

## Next Steps

1. Run `bunx vargai init` to initialize project
2. Add your FAL_KEY to `.env`
3. Run `bunx vargai render hello.tsx`
4. Or ask the agent: "create a 10 second tiktok video about cats"
