# Photify AI - Concept 4: Animated Family Photos

## Overview
Create 15 video creatives showing "talking heads" emotionally reacting to animated vintage family photos. Each video uses the same 5 animated retro photos as background, with different characters wiping away tears.

## Deliverables per video
- 2 formats: 4x5 (1080x1350) + 9x16 (1080x1920)
- CapCut-style dynamic subtitles
- Background music/sfx
- Packshot at end: `media/Packshot_9_16.mp4`

## Assets to Generate

### 1. Animated Retro Photos (5 total, shared across all videos)
| # | Description | Status |
|---|-------------|--------|
| 1 | Young grandparents sitting side by side, holding hands | video generated |
| 2 | Woman holding cat, cat rubbing against her hand | pending |
| 3 | New Year by old tree, two kids in costumes, adults nearby | pending |
| 4 | Old person on porch of old house | pending |
| 5 | Family dinner gathering | pending |

### 2. Talking Head Characters (15 total)
| # | Description |
|---|-------------|
| 1 | Girl with long light brown hair (25-30), natural makeup |
| 2 | Asian girl with short black hair and bangs (20-25) |
| 3 | Girl with red curls and freckles (25-35) |
| 4 | Girl with bright colored hair (pink/blue), edgy (18-25) |
| 5 | Girl with bangs and long dark hair (25-30) |
| 6 | Middle-aged woman with gray streaks (40-50) |
| 7 | Girl with soft curls, warm skin tone (30-40) |
| 8 | Girl with shaved side, asymmetric cut (20-30) |
| 9 | Dark-skinned girl with afro curls, wide smile (25-35) |
| 10 | Girl with long braids or dreads (18-30) |
| 11 | Girl with glasses, bob haircut (30-40) |
| 12 | Young girl with short cut, septum piercing (25-35) |
| 13 | Girl with super long platinum white hair |
| 14 | Asian woman with neat haircut, glasses, big eyes |
| 15 | Dark-skinned girl with wavy pink hair (wig), bold makeup (18-25) |

## Script
**Voice:** "Guys... I animated old family photos with Photify, and realized my great-grandma had the exact same smile as me."

**Action:** Character wipes tears (touched, not overly dramatic)

---

## Implementation Plan (with CLI commands)

### Phase 1: Generate Retro Photos (static images)

```bash
# Generate vintage-style family photos
varg run image --prompt "1970s vintage photograph, young couple sitting on couch holding hands, film grain, sepia tones, authentic retro family photo" --quiet

varg run image --prompt "1960s vintage photograph, woman holding cat lovingly, cat rubbing against her arm, film grain, warm sepia, authentic retro" --quiet

varg run image --prompt "1980s vintage photograph, New Year celebration by decorated tree, two children in costumes, adults watching, film grain, nostalgic" --quiet

varg run image --prompt "1950s vintage photograph, elderly person sitting on wooden porch of old farmhouse, film grain, black and white" --quiet

varg run image --prompt "1970s vintage photograph, large family gathered around dinner table, celebration, warm lighting, film grain, authentic retro" --quiet
```

### Phase 2: Animate Retro Photos (image-to-video)

```bash
# Animate each photo with subtle motion
varg run video --image output/retro_1.png --prompt "subtle gentle movement, breathing, slight sway, nostalgic atmosphere" --quiet
# repeat for all 5
```

### Phase 3: Generate Talking Head Portraits

```bash
# Generate character portraits (15 total)
varg run image --prompt "portrait photo of young woman 25-30, long light brown hair, natural makeup, neutral background, looking at camera, emotional expression" --quiet
# repeat for all 15 characters with their descriptions
```

### Phase 4: Generate Voice Audio

```bash
# Generate TTS for the script
varg run voice --text "Guys... I animated old family photos with Photify, and realized my great-grandma had the exact same smile as me." --voice rachel --quiet
```

### Phase 5: Create Talking Head Videos with Lipsync

```bash
# Use sync action for lipsync - 10 second duration to fit full audio
# Character image should have GREEN BACKGROUND for compositing
varg run sync --image output/character_1_greenscreen.png --audio output/voice.mp3 --prompt "woman speaking emotionally, warm expression, wiping tears" --duration 10 --resolution 720p --quiet

# Then use ffmpeg chromakey to remove green background when compositing
```

**IMPORTANT:**
- Generate character portraits with GREEN BACKGROUND for easy chromakey removal
- Use 10 second duration (audio is ~7s, will trim excess)
- Prompt should emphasize WARM, EMOTIONAL expression (not cold/neutral)

### Phase 6: Assembly (ffmpeg operations)

```bash
# Composite talking head over animated background
varg run merge --inputs output/retro_animated.mp4 output/talking_head.mp4 --quiet

# Add captions
varg run captions --video output/merged.mp4 --quiet

# Trim/adjust timing
varg run trim --input output/captioned.mp4 --start 0 --end 15 --quiet

# Add packshot at end
varg run merge --inputs output/main.mp4 Packshot_9_16.mp4 --quiet

# Add fade transitions
varg run fade --input output/final.mp4 --type both --quiet
```

### Phase 7: Export Both Formats

Need to handle aspect ratio crops/resizing:
- 9x16 (1080x1920) - vertical TikTok/Reels
- 4x5 (1080x1350) - Instagram feed

---

## Questions
- [ ] Voice: generate TTS or do you have recordings?
- [ ] Music/sfx preferences?
- [ ] Should all 15 characters use same 5 background photos, or vary?
