---
description: Video generation quickstart and onboarding for varg SDK. Use when user asks to create videos, animations, talking characters, or social media content. ALWAYS run onboarding first for new users.
---

# Video Generation with varg React Engine

## Overview

This skill helps you generate AI videos using the varg SDK's React engine. It provides:
- Declarative JSX syntax for video composition
- Automatic caching (same props = instant cache hit)
- Parallel generation where possible
- Support for images, video, music, voice, and captions

## Step 1: Onboarding (REQUIRED for new users)

Before generating videos, ensure the user has the required API keys configured.

### Check Current Setup

Run this command to check existing configuration:

```bash
cat .env 2>/dev/null | grep -E "^(FAL_API_KEY|ELEVENLABS_API_KEY|REPLICATE_API_TOKEN|GROQ_API_KEY)=" || echo "No API keys found in .env"
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

Check which features are available based on configured keys:

| Feature | Required Key | Provider | Get It |
|---------|-------------|----------|--------|
| Music generation | `ELEVENLABS_API_KEY` | ElevenLabs | https://elevenlabs.io/app/settings/api-keys |
| Voice/Speech | `ELEVENLABS_API_KEY` | ElevenLabs | https://elevenlabs.io/app/settings/api-keys |
| Lipsync | `REPLICATE_API_TOKEN` | Replicate | https://replicate.com/account/api-tokens |
| Transcription | `GROQ_API_KEY` | Groq | https://console.groq.com/keys |

**When keys are missing, inform user:**
- "Music/voice features require ELEVENLABS_API_KEY - skipping those features"
- "Lipsync requires REPLICATE_API_TOKEN - skipping lipsync"
- "Transcription requires GROQ_API_KEY - skipping auto-captions"

### Add Keys to .env

Help user create or update `.env`:

```bash
# .env - place in project root

# REQUIRED - minimum for video generation
FAL_API_KEY=fal_xxxxxxxxxxxxx

# OPTIONAL - for music and voice
ELEVENLABS_API_KEY=xxxxxxxxxxxxx

# OPTIONAL - for lipsync
REPLICATE_API_TOKEN=r8_xxxxxxxxxxxxx

# OPTIONAL - for transcription/captions
GROQ_API_KEY=gsk_xxxxxxxxxxxxx
```

### Verify Setup (Quick Test)

After adding FAL_API_KEY, run verification:

```bash
bun run src/react/examples/quickstart-test.tsx
```

This generates a simple 3-second animation to confirm the API is working.
Expected output: `output/quickstart-test.mp4`

If test fails:
- Check API key is correct (no extra spaces)
- Ensure .env is in project root
- Try running `bun install` if dependencies are missing

## Step 2: Available Features Summary

After onboarding, summarize what's available:

**With FAL_API_KEY only:**
- Image generation (Flux models)
- Image-to-video animation (Wan 2.5, Kling)
- Text-to-video generation
- Image slideshows with transitions
- Ken Burns zoom effects

**With FAL + ELEVENLABS:**
- All above, plus:
- AI-generated background music
- Text-to-speech voiceovers
- Talking character videos

**With all keys:**
- Full production pipeline
- Lipsync for talking heads
- Auto-generated captions
- Social media optimization

## Step 3: Video Templates

### Template 1: Simple Image Slideshow (FAL only)

Minimal example - just images with transitions:

```tsx
// slideshow.tsx
import { render, Render, Clip, Image } from "vargai/react";

const SCENES = [
  "sunset over ocean, cinematic golden hour",
  "mountain peaks at dawn, misty atmosphere",
  "city skyline at night, neon lights",
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

Run: `bun run slideshow.tsx`

### Template 2: Animated Video with Music (FAL + ElevenLabs)

```tsx
// animated-video.tsx
import { render, Render, Clip, Image, Animate, Music } from "vargai/react";
import { fal, elevenlabs } from "vargai/ai";

await render(
  <Render width={1080} height={1920}>
    <Music
      prompt="upbeat electronic pop, energetic, modern"
      model={elevenlabs.musicModel()}
      duration={10}
      volume={0.7}
    />

    <Clip duration={5}>
      <Animate
        image={Image({ prompt: "cute cat sitting on windowsill, golden hour lighting" })}
        motion="cat slowly turns head, blinks, tail swishes gently"
        model={fal.videoModel("wan-2.5")}
        duration={5}
      />
    </Clip>

    <Clip duration={5} transition={{ name: "fade", duration: 0.5 }}>
      <Animate
        image={Image({ prompt: "same cat stretching on windowsill" })}
        motion="cat stretches, yawns, settles back down"
        model={fal.videoModel("wan-2.5")}
        duration={5}
      />
    </Clip>
  </Render>,
  { output: "output/cat-video.mp4" }
);
```

Run: `bun run animated-video.tsx`

### Template 3: Talking Character (FAL + ElevenLabs)

```tsx
// talking-character.tsx
import { render, Render, Clip, Image, Animate, Speech } from "vargai/react";
import { fal, elevenlabs } from "vargai/ai";

const CHARACTER = "friendly cartoon robot, blue metallic, expressive eyes, studio background";
const SCRIPT = `
  Hello! I'm your AI assistant. 
  Today I'm going to show you something amazing.
  Let's get started!
`;

await render(
  <Render width={1080} height={1920}>
    <Clip duration="auto">
      <Animate
        image={Image({ prompt: CHARACTER, aspectRatio: "9:16" })}
        motion="robot talking naturally, subtle head movements, eyes blink occasionally"
        model={fal.videoModel("wan-2.5")}
      />
      <Speech voice="adam" model={elevenlabs.speechModel("turbo")}>
        {SCRIPT}
      </Speech>
    </Clip>
  </Render>,
  { output: "output/talking-robot.mp4" }
);
```

Run: `bun run talking-character.tsx`

### Template 4: TikTok Multi-Clip Video (Full Production)

```tsx
// tiktok-video.tsx
import { render, Render, Clip, Image, Animate, Music, Title } from "vargai/react";
import { fal, elevenlabs } from "vargai/ai";

const CHARACTER = "confident young woman, casual style, bright smile";

const SCENES = [
  { prompt: "extreme close-up face, surprised expression", motion: "eyes widen, eyebrows raise" },
  { prompt: "medium shot, laughing genuinely", motion: "head tilts back slightly, genuine laugh" },
  { prompt: "close-up, knowing smirk", motion: "slow smile forms, subtle head nod" },
  { prompt: "medium shot, waving at camera", motion: "waves energetically, bright smile" },
];

await render(
  <Render width={1080} height={1920}>
    <Music
      prompt="trendy tiktok music, upbeat, catchy hook"
      model={elevenlabs.musicModel()}
      duration={8}
      volume={0.6}
    />

    {SCENES.map((scene, i) => (
      <Clip key={i} duration={2} transition={{ name: "fade", duration: 0.3 }}>
        <Animate
          image={Image({ prompt: `${CHARACTER}, ${scene.prompt}`, aspectRatio: "9:16" })}
          motion={scene.motion}
          model={fal.videoModel("wan-2.5")}
          duration={5}
        />
        {i === 0 && <Title position="bottom">POV: When it actually works</Title>}
      </Clip>
    ))}
  </Render>,
  { output: "output/tiktok-video.mp4" }
);
```

Run: `bun run tiktok-video.tsx`

## Step 4: Running Videos

### Basic Run

```bash
bun run your-video.tsx
```

### With Caching (Recommended)

Videos are cached automatically. To use a specific cache directory:

```tsx
await render(<Render>...</Render>, {
  output: "output/video.mp4",
  cache: ".cache/ai"  // Cached assets stored here
});
```

### Output Location

- Default output: `output/` folder
- Create it if needed: `mkdir -p output`

## Step 5: Key Components Reference

| Component | Purpose | Required Key |
|-----------|---------|--------------|
| `<Render>` | Root container, sets dimensions | - |
| `<Clip>` | Sequential video segment | - |
| `<Image>` | AI-generated or local image | FAL |
| `<Video>` | Video file or generated video | FAL |
| `<Animate>` | Image-to-video animation | FAL |
| `<Music>` | AI-generated background music | ElevenLabs |
| `<Speech>` | Text-to-speech voiceover | ElevenLabs |
| `<Title>` | Text overlay | - |
| `<Captions>` | Auto-generated subtitles | Groq/Fireworks |

## Step 6: Common Patterns

### Character Consistency

Reuse the same Image reference for consistent character:

```tsx
const character = Image({ prompt: "blue robot, friendly" });

<Clip><Animate image={character} motion="waving" /></Clip>
<Clip><Animate image={character} motion="dancing" /></Clip>
// Same character in both clips - same cache key = same generated image
```

### Transitions

Available transitions: `fade`, `crossfade`, `wipeleft`, `wiperight`, `cube`, `slideup`, `slidedown`, etc.

```tsx
<Clip transition={{ name: "fade", duration: 0.5 }}>
```

### Aspect Ratios

- `9:16` - TikTok, Instagram Reels, YouTube Shorts (vertical)
- `16:9` - YouTube, Twitter (horizontal)
- `1:1` - Instagram posts (square)

### Zoom Effects (Ken Burns)

```tsx
<Image prompt="landscape" zoom="in" />   // Zoom in
<Image prompt="landscape" zoom="out" />  // Zoom out
<Image prompt="landscape" zoom="left" /> // Pan left
<Image prompt="landscape" zoom="right" />// Pan right
```

## Troubleshooting

### "FAL_API_KEY not found"
- Check `.env` file exists in project root
- Ensure no spaces around `=` sign
- Restart terminal after adding keys

### "Rate limit exceeded"
- Free tier has limited credits
- Wait a few minutes or upgrade plan
- Use caching to avoid regenerating same assets

### "Video generation failed"
- Check prompt doesn't violate content policy
- Try simpler motion descriptions
- Reduce video duration

### "Music/Voice not working"
- Verify `ELEVENLABS_API_KEY` is set
- Check ElevenLabs account has credits
- Try a different voice model

## Next Steps After First Video

1. Experiment with different prompts and styles
2. Try combining multiple clips with transitions
3. Add music and voiceover for richer content
4. Create reusable character components
5. Build a content pipeline for batch generation
