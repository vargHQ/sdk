---
name: varg-video-generation
description: This skill should be used when the user asks to "create a video", "generate a video", "render a tsx", "make a slideshow", "create a talking character", or "animate an image" using the varg React engine.
license: MIT
metadata:
  author: vargHQ
  version: "1.0.0"
compatibility: Requires bun runtime. FAL_API_KEY required. Optional ELEVENLABS_API_KEY, REPLICATE_API_TOKEN, GROQ_API_KEY
allowed-tools: Bash(bun:*) Bash(cat:*) Read Write Edit
---

# Video Generation with varg React Engine

Generate AI videos using declarative JSX syntax with automatic caching and parallel generation.

## Execution policy (must follow)

- Ask for confirmation before running any command that triggers paid API calls.
- Proceed without extra confirmation only when the user explicitly asks to run/render/generate now.
- Prefer CLI execution after creating TSX; do not leave TSX files unrun.
- Prefer `preview` for zero-cost checks before paid renders.
- Write outputs to `output/` and do not commit new outputs.

## Quick Setup

Run the setup script to initialize a project:

```bash
bun scripts/setup.ts
```

Or check API keys directly:

```bash
cat .env 2>/dev/null | grep -E "^(FAL_API_KEY|ELEVENLABS_API_KEY)=" || echo "No API keys found"
```

## Required API Keys

### FAL_API_KEY (Required)

| Detail | Value |
|--------|-------|
| Provider | Fal.ai |
| Get it | https://fal.ai/dashboard/keys |
| Free tier | Yes (limited credits) |
| Used for | Image generation (Flux), Video generation (Wan 2.5, Kling) |

If user doesn't have `FAL_API_KEY`:
1. Direct them to https://fal.ai/dashboard/keys
2. Create account and generate API key
3. Add to `.env` file: `FAL_API_KEY=fal_xxxxx`

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
import { render, Render, Clip, Image } from "vargai/react";

const SCENES = ["sunset over ocean", "mountain peaks", "city at night"];

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

See [references/templates.md](references/templates.md) for more templates.

## Running Videos

```bash
# preferred: render via CLI after creating TSX
bun run src/cli/index.ts render your-video.tsx -o output/your-video.mp4

# optional: fast, zero-cost preview
bun run src/cli/index.ts preview your-video.tsx

# direct execution (acceptable but less consistent)
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

### "FAL_API_KEY not found"
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

1. Run `bun scripts/setup.ts` to initialize project
2. Add your FAL_API_KEY to `.env`
3. Run `bun run examples/my-first-video.tsx`
4. Or ask the agent: "create a 10 second tiktok video about cats"
