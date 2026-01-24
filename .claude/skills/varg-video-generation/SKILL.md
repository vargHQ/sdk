---
name: varg-video-generation
description: Generate AI videos using varg SDK React engine. Use when creating videos, animations, talking characters, slideshows, or social media content. Always run onboarding first to check API keys.
license: MIT
metadata:
  author: vargHQ
  version: "1.0.0"
compatibility: Requires bun runtime. FAL_API_KEY required. Optional ELEVENLABS_API_KEY, REPLICATE_API_TOKEN, GROQ_API_KEY
allowed-tools: Bash(bun:*) Bash(cat:*) Read Write Edit
---

# Video Generation with varg React Engine

## Overview

This rule helps you generate AI videos using the varg SDK's React engine. It provides:
- Declarative JSX syntax for video composition
- Automatic caching (same props = instant cache hit)
- Parallel generation where possible
- Support for images, video, music, voice, and captions

## Step 1: Onboarding (REQUIRED for new users)

Before generating videos, ensure the user has the required API keys configured.

### Check Current Setup

**CRITICAL: NEVER expose API key values. Only check if keys exist, never display their values.**

Run this command to check existing configuration (without exposing values):

```bash
cat .env 2>/dev/null | grep -E "^(FAL_API_KEY|ELEVENLABS_API_KEY|REPLICATE_API_TOKEN|GROQ_API_KEY|HIGGSFIELD_API_KEY)=" | cut -d'=' -f1 | while read key; do echo "$key=***configured***"; done || echo "No API keys found"
```

### Required: FAL_API_KEY

**This is the minimum requirement for video generation.**

| Detail | Value |
|--------|-------|
| Provider | Fal.ai |
| Get it | https://fal.ai/dashboard/keys |
| Free tier | Yes (limited credits) |
| Used for | Image generation (Flux), Video generation (Wan 2.5, Kling) |

If user doesn't have `FAL_API_KEY`:
1. Direct them to https://fal.ai/dashboard/keys
2. They need to create an account and generate an API key
3. Add to `.env` file in project root

### Optional Keys (warn if missing, but continue)

| Feature | Required Key | Provider | Get It |
|---------|-------------|----------|--------|
| Music generation | `ELEVENLABS_API_KEY` | ElevenLabs | https://elevenlabs.io/app/settings/api-keys |
| Voice/Speech | `ELEVENLABS_API_KEY` | ElevenLabs | https://elevenlabs.io/app/settings/api-keys |
| Lipsync | `REPLICATE_API_TOKEN` | Replicate | https://replicate.com/account/api-tokens |
| Transcription | `GROQ_API_KEY` | Groq | https://console.groq.com/keys |

**When keys are missing, inform user what features are unavailable.**

## Step 2: Quick Templates

### Simple Slideshow (FAL only)

```tsx
import { render, Render, Clip, Image } from "vargai/react";

const SCENES = [
  "sunset over ocean, cinematic",
  "mountain peaks at dawn, misty",
  "city skyline at night, neon",
];

await render(
  <Render width={1080} height={1920}>
    {SCENES.map((prompt, i) => (
      <Clip key={i} duration={3} transition={{ name: "fade", duration: 0.5 }}>
        <Image prompt={prompt} zoom="in" />
      </Clip>
    ))}
  </Render>,
  { output: "output/slideshow.mp4" }
);
```

### Animated Video (FAL + ElevenLabs)

```tsx
import { render, Render, Clip, Image, Animate, Music } from "vargai/react";
import { fal, elevenlabs } from "vargai/ai";

await render(
  <Render width={1080} height={1920}>
    <Music prompt="upbeat electronic" model={elevenlabs.musicModel()} duration={10} />
    <Clip duration={5}>
      <Animate
        image={Image({ prompt: "cute cat on windowsill" })}
        motion="cat turns head, blinks slowly"
        model={fal.videoModel("wan-2.5")}
        duration={5}
      />
    </Clip>
  </Render>,
  { output: "output/video.mp4" }
);
```

### Talking Character

```tsx
import { render, Render, Clip, Image, Animate, Speech } from "vargai/react";
import { fal, elevenlabs } from "vargai/ai";

await render(
  <Render width={1080} height={1920}>
    <Clip duration="auto">
      <Animate
        image={Image({ prompt: "friendly robot, blue metallic", aspectRatio: "9:16" })}
        motion="robot talking, subtle head movements"
        model={fal.videoModel("wan-2.5")}
      />
      <Speech voice="adam" model={elevenlabs.speechModel("turbo")}>
        Hello! I'm your AI assistant. Let's create something amazing!
      </Speech>
    </Clip>
  </Render>,
  { output: "output/talking-robot.mp4" }
);
```

## Step 3: Running Videos

```bash
bun run your-video.tsx
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
// Reuse same reference for consistent appearance
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

## Troubleshooting

### "FAL_API_KEY not found"
- Check `.env` file exists in project root
- Ensure no spaces around `=` sign
- Restart terminal after adding keys

### "Rate limit exceeded"
- Free tier has limited credits
- Wait or upgrade plan
- Use caching to avoid regenerating

## Next Steps

1. Add your FAL_API_KEY to `.env`
2. Run `bun run examples/my-first-video.tsx`
3. Or ask the agent: "create a 10 second tiktok video about cats"
