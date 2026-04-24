---
name: varg-video-generation
description: Generate AI videos using varg SDK React engine. Use when creating videos, animations, talking characters, slideshows, or social media content. Always run onboarding first to check API keys.
license: MIT
metadata:
  author: vargHQ
  version: "1.0.0"
compatibility: Requires bun runtime. FAL_KEY required. Optional ELEVENLABS_API_KEY, REPLICATE_API_TOKEN, GROQ_API_KEY
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

Run this command to check existing configuration:

```bash
cat .env 2>/dev/null | grep -E "^(FAL_KEY|ELEVENLABS_API_KEY|REPLICATE_API_TOKEN|GROQ_API_KEY)=" || echo "No API keys found in .env"
```

### Required: FAL_KEY

**This is the minimum requirement for video generation.**

| Detail | Value |
|--------|-------|
| Provider | Fal.ai |
| Get it | https://fal.ai/dashboard/keys |
| Free tier | Yes (limited credits) |
| Used for | Image generation (Flux), Video generation (Wan 2.5, Kling) |

If user doesn't have `FAL_KEY`:
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

## Step 2: Running Videos

```bash
bunx vargai render video.tsx
```

## Key Components

| Component | Purpose | Required Key |
|-----------|---------|--------------|
| `<Render>` | Root container | - |
| `<Clip>` | Sequential segment | - |
| `<Image>` | AI image | FAL |
| `<Video>` | AI video | FAL |
| `<Music>` | Background music | ElevenLabs |
| `<Speech>` | Text-to-speech | ElevenLabs |

## Common Patterns

### Character Consistency
```tsx
const character = Image({ prompt: "blue robot" });
// Reuse same reference for consistent appearance
<Video prompt={{ text: "waving", images: [character] }} />
<Video prompt={{ text: "dancing", images: [character] }} />
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
