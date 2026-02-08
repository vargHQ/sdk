# varg SDK Video Templates

Ready-to-use TSX templates for AI video generation with optimized prompts based on community research.

## Quick Start

```bash
# Render any template
bunx vargai render sdk-templates/kling.tsx
bunx vargai render sdk-templates/minimax.tsx
bunx vargai render sdk-templates/wan.tsx
bunx vargai render sdk-templates/hunyuan.tsx
```

## Templates Overview

### 🎬 [kling.tsx](./kling.tsx)
**Best for:** Multi-shot narratives, dialogue scenes, character consistency

Models: `kling-v2.6` (native audio), `kling-v2.5-turbo`, `kling-v2.1`

Key strengths:
- Think in shots, not clips
- Motion verbs: `dolly push`, `whip-pan`, `crash zoom`
- Named light sources, texture details
- Multi-character dialogue with voice

Templates included:
1. Cinematic product video
2. Talking head with lipsync
3. Dialogue scene structure
4. Action/dynamic scene
5. Atmospheric mood piece
6. Character consistency examples

---

### 🌟 [minimax.tsx](./minimax.tsx)
**Best for:** Cinematic shots, facial expressions, rack focus, dolly zoom

Model: `minimax`

Key strengths:
- Rack focus works beautifully
- Dolly zoom (vertigo effect) specialty
- Detailed prompt structure required
- Put important things FIRST (attention priority)

Templates included:
1. Urban nightlife (cinematic)
2. Nature documentary
3. Rack focus effect
4. Dolly zoom / vertigo
5. Premium product video
6. Character portrait with expression
7. UGC talking head with lipsync
8. Atmospheric mood scene

---

### 🎨 [wan.tsx](./wan.tsx)
**Best for:** Camera movements, stylized content, flexibility

Models: `wan-2.5`, `wan-2.5-preview`

Key strengths:
- Exceptional camera movement adherence
- Multiple artistic styles (cyberpunk, anime, pixel art)
- Speed effects (slow-mo, time-lapse)
- Good balance of speed and quality

Templates included:
1. Close-up portrait
2. Tracking shot (Wan specialty)
3. Dolly push-in
4. Orbit shot
5. Time-lapse effect
6. Slow motion
7. Cyberpunk style
8. Anime style
9. Product showcase
10. Talking head with lipsync
11. Atmospheric scene

---

### 📐 [hunyuan.tsx](./hunyuan.tsx)
**Best for:** Realistic scenes, detailed prompts, long videos

Note: Uses `wan-2.5` as Hunyuan isn't directly on fal.ai. Prompts optimized for Hunyuan-style detailed descriptions.

Key strengths:
- 7-component prompt structure
- 100-300 word optimal prompts
- Free and open source
- Better prompt adherence than Wan

Templates included:
1. Serene mountain hiker
2. Bustling city street
3. Ocean sunset
4. Coffee shop morning
5. Night market
6. Product reveal
7. Talking head (detailed style)
8. Forest path

---

## Prompt Cheat Sheet

### Universal Best Practices

```
1. ONE action per generation (don't stack multiple actions)
2. Be specific (not "good lighting" but "soft window light from left")
3. Include camera movement (always!)
4. Use temporal flow: beginning → middle → end
5. Generate multiple variations (AI video is unpredictable)
```

### Model Comparison

| Model | Strengths | Best Use Case |
|-------|-----------|---------------|
| Kling 3.0/2.6 | Multi-shot, dialogue, audio | Narrative content |
| MiniMax | Rack focus, expressions | Cinematic beauty shots |
| Wan 2.5 | Camera movements, styles | Stylized / creative |
| Hunyuan | Detailed prompts, long video | Realistic scenes |

### Camera Movements (Universal)

```
- Dolly in / Push in
- Dolly out / Pull back
- Pan left / right
- Tilt up / down
- Tracking shot
- Orbit / Arc shot
- Crane shot
- Steadicam
- Handheld
```

### Photorealism Keywords

```
photorealistic, hyper-detailed, shot on Arri Alexa,
8k resolution, cinematic movie style, natural lighting
```

---

## Customization

Each template has a `CONFIG` object at the top:

```tsx
const CONFIG = {
  model: "kling-v2.6",
  width: 1080,
  height: 1920,
  voiceId: "5l5f8iK3YPeGga21rQIX",
};
```

### Common Dimensions

- **9:16 Vertical (TikTok/Reels):** 1080x1920
- **16:9 Horizontal:** 1920x1080
- **1:1 Square:** 1080x1080

### ElevenLabs Voice IDs

Find voices at [elevenlabs.io/voice-library](https://elevenlabs.io/voice-library)

---

## Research Source

These templates are based on comprehensive prompt research from:
- Reddit communities (r/StableDiffusion, r/aivideo, r/comfyui)
- Official documentation (Kling, MiniMax, Hunyuan)
- Community guides and best practices

See full research: `/memory/video-prompts-research.md`
