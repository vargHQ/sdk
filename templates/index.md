# SDK Video Templates

Ready-to-use video generation templates with optimized prompts for each model.

## Quick Start

```bash
# List all templates for a model
bun run sdk-templates/kling.tsx
bun run sdk-templates/minimax.tsx
bun run sdk-templates/wan.tsx
bun run sdk-templates/hunyuan.tsx

# Generate a specific template
bun run sdk-templates/kling.tsx cinematic neoNoir
bun run sdk-templates/minimax.tsx rackfocus dialogueTension
bun run sdk-templates/wan.tsx transform seasonsChange
bun run sdk-templates/hunyuan.tsx realistic mountainHiker
```

---

## Model Comparison

| Model | Best For | Cost | Max Duration |
|-------|----------|------|--------------|
| **Kling 3.0** | Multi-shot, dialogue, narrative | $$$ | 15s |
| **MiniMax/Hailuo** | Rack focus, expressions, stylized | $$ | 6s |
| **Wan 2.1** | Open-source, transformations, camera | $ | 5s |
| **Hunyuan** | Realistic, long videos, **FREE** | 🆓 | 16s |

---

## Templates by Model

### 📹 Kling 3.0 (`kling.tsx`)

**Best for:** Multi-shot narratives, dialogue, character consistency

| Category | Templates |
|----------|-----------|
| **Product** | `techProduct`, `luxuryWatch`, `sneakerReveal` |
| **Talking Head** | `corporateSpeaker`, `influencerStyle`, `testimonialReal` |
| **Cinematic** | `neoNoir`, `goldenHour`, `thrillerTension` |
| **Multi-shot** | `morningRoutine`, `actionChase`, `productStory` |

**Key prompting rules:**
- Think in SHOTS, not clips
- Use motion verbs: `dolly push`, `whip-pan`, `crash zoom`
- Name REAL light sources (not "dramatic lighting")
- Include TEXTURE: grain, reflections, condensation

---

### 🎬 MiniMax/Hailuo (`minimax.tsx`)

**Best for:** Cinematic rack focus, facial expressions, stylized content

| Category | Templates |
|----------|-----------|
| **Rack Focus** | `dialogueTension`, `objectReveal`, `naturePredator` |
| **Character** | `emotionalJoy`, `subtleSuspicion`, `dancerMotion` |
| **Product** | `perfumeCommercial`, `techDevice`, `foodCommercial` |
| **Stylized** | `animeScene`, `vintageFilm`, `surrealistDream`, `cyberpunkCity` |

**Key prompting rules:**
- Put important elements FIRST
- Use POSITIVE descriptions (no negatives)
- Structure: `[Camera] + [Subject] + [Action] + [Scene] + [Lighting] + [Style]`
- For consistency: use `(( ))` around unique character features

---

### 🌊 Wan 2.1 (`wan.tsx`)

**Best for:** Open-source, transformations, camera movements

| Category | Templates |
|----------|-----------|
| **Realistic** | `streetLife`, `quietMoment`, `urbanRain` |
| **Transform** | `dayToNight`, `seasonsChange`, `ageProgression` |
| **Camera** | `dollyPushIn`, `orbitShot`, `craneShot`, `whipPan` |
| **Atmospheric** | `foggyMorning`, `lonelyHighway`, `tenseStandoff`, `majesticScale` |

**Prompting formulas:**
- Basic: `Subject + Scene + Motion`
- Advanced: `+ Camera Language + Atmosphere + Style`
- Transform: `Subject A + Process + Subject B + Scene + Motion`

---

### 🆓 Hunyuan (`hunyuan.tsx`)

**Best for:** Realistic scenes, FREE TIER, long videos up to 16s

| Category | Templates |
|----------|-----------|
| **Realistic** | `mountainHiker`, `streetVendor`, `childPlaying`, `coffeeShop` |
| **Camera Demo** | `zoomInDemo`, `panLeftDemo`, `aroundRightDemo`, `tiltUpDemo`, `handheldDemo` |
| **Product** | `skincareProduct`, `shoeProduct`, `bookProduct`, `beverageCan` |
| **ComfyUI** | `sunsetBeach`, `cityTraffic`, `catNapping`, `waterfall` |

**7 Essential components:**
1. Subject
2. Scene
3. Motion
4. Camera Movement
5. Atmosphere
6. Lighting
7. Shot Composition

**Camera keywords:**
```
zoom in, zoom out, pan up, pan down, pan left, pan right,
tilt up, tilt down, around left, around right, static shot, handheld shot
```

---

## Universal Tips

### Prompt Priority (when short on space)
1. **Subject** (who/what) — never skip
2. **Action** (what they're doing) — makes it dynamic
3. **Camera** (how we see it) — defines the shot
4. **Lighting** (photorealistic keywords) — prevents cartoon look
5. **Scene** (where) — can be simplified
6. **Style** (the feel) — can be minimal

### Best Practices
- ✅ One action per generation
- ✅ Describe motion explicitly (subject AND camera)
- ✅ Use specific camera terminology
- ✅ Named light sources (not "good lighting")
- ✅ Generate 3-5 variations
- ✅ Copy-paste character descriptions exactly

### Avoid
- ❌ Essay-length prompts
- ❌ Multiple conflicting actions
- ❌ No camera direction
- ❌ Generic adjectives ("nice", "lovely")
- ❌ Expecting perfection from one generation

---

## Photorealism Keywords

Add these to avoid cartoonish output:
```
photorealistic, hyper-detailed, shot on Arri Alexa,
8k resolution, cinematic movie style, natural lighting
```

---

## Negative Prompts (where supported)

```
blurry, pixelated, low resolution, grainy, distorted,
watermark, text, logo, signature
```

Note: MiniMax/Hailuo prefers positive prompting over negatives.

---

## Files

```
sdk-templates/
├── index.md        # This overview
├── kling.tsx       # Kling 3.0 templates
├── minimax.tsx     # MiniMax/Hailuo templates
├── wan.tsx         # Wan 2.1 templates
└── hunyuan.tsx     # Hunyuan templates
```

---

*Based on research from Reddit, fal.ai, official docs, and community guides. See `memory/video-prompts-research.md` for full research notes.*
