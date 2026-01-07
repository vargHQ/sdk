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
# Generate character portraits (15 total) with GREEN BACKGROUND for chromakey
varg run image --prompt "portrait photo of young woman 25-30, long light brown hair, natural makeup, SOLID BRIGHT GREEN BACKGROUND for chromakey, looking at camera with warm emotional touched expression, eyes glistening with happy tears, gentle smile" --quiet
# repeat for all 15 characters with their descriptions
# IMPORTANT: Always include "SOLID BRIGHT GREEN BACKGROUND for chromakey" and warm/emotional expression
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
# Step 1: Composite talking head over animated background with CHROMAKEY
# - Loop background to extend duration
# - Remove green screen from talking head
# - Crop talking head to portrait (face focus) to avoid head cutoff
# - Position at bottom with padding
ffmpeg -y \
  -i media/retro/01_grandparents.mp4 \
  -stream_loop 1 -i media/retro/01_grandparents.mp4 \
  -i output/scene01/talking_head.mp4 \
  -filter_complex "\
    [0:v][1:v]concat=n=2:v=1:a=0[bglong]; \
    [bglong]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[bg]; \
    [2:v]chromakey=0x00ff00:0.3:0.1,crop=600:700:250:50,scale=350:-1[fg]; \
    [bg][fg]overlay=(W-w)/2:H-h-80[out]" \
  -map "[out]" -map 2:a \
  -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k \
  -t 7 \
  output/scene01/composite.mp4

# CHROMAKEY PARAMS:
# - 0x00ff00 = green color to remove
# - 0.3 = similarity threshold (how close to green to remove)
# - 0.1 = blend (edge softness)
#
# CROP PARAMS for talking head (crop=600:700:250:50):
# - 600:700 = output width:height (portrait crop)
# - 250:50 = x:y offset from top-left (centers on face)
# Adjust these values based on each character's face position
#
# OVERLAY POSITION:
# - (W-w)/2 = horizontally centered
# - H-h-80 = 80px padding from bottom

# Step 2: Burn in captions (smaller font, positioned above character)
ffmpeg -y \
  -i output/scene01/composite.mp4 \
  -vf "subtitles='output/scene01/captions.srt':force_style='FontSize=18,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,Outline=2,Bold=1,Alignment=2,MarginV=500'" \
  -c:a copy \
  output/scene01/captioned.mp4

# CAPTION PARAMS:
# - FontSize=18 (smaller, fits better)
# - Alignment=2 (bottom center, but MarginV pushes it up)
# - MarginV=500 (pixels from bottom - positions above character)

# Step 3: Concat with packshot (9x16)
ffmpeg -y \
  -i output/scene01/captioned.mp4 \
  -i media/Packshot_9_16.mp4 \
  -filter_complex "\
    [0:v]fps=24,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2[v0]; \
    [1:v]fps=24,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2[v1]; \
    [v0][0:a][v1][1:a]concat=n=2:v=1:a=1[outv][outa]" \
  -map "[outv]" -map "[outa]" \
  -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k \
  output/scene01/final_9x16.mp4

# Step 4: Create 4x5 version
# NOTE: Character positioning needs adjustment for 4x5 crop
# The 4x5 frame is shorter, so character may get cut off
# Solution: Re-composite with adjusted overlay position for 4x5
ffmpeg -y \
  -i media/retro/01_grandparents.mp4 \
  -stream_loop 1 -i media/retro/01_grandparents.mp4 \
  -i output/scene01/talking_head.mp4 \
  -filter_complex "\
    [0:v][1:v]concat=n=2:v=1:a=0[bglong]; \
    [bglong]scale=1080:1350:force_original_aspect_ratio=increase,crop=1080:1350,setsar=1[bg]; \
    [2:v]chromakey=0x00ff00:0.3:0.1,crop=600:700:250:50,scale=300:-1[fg]; \
    [bg][fg]overlay=(W-w)/2:H-h-60[out]" \
  -map "[out]" -map 2:a \
  -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k \
  -t 7 \
  output/scene01/composite_4x5.mp4

# Add captions for 4x5 (adjust MarginV for shorter frame)
ffmpeg -y \
  -i output/scene01/composite_4x5.mp4 \
  -vf "subtitles='output/scene01/captions.srt':force_style='FontSize=16,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,Outline=2,Bold=1,Alignment=2,MarginV=380'" \
  -c:a copy \
  output/scene01/captioned_4x5.mp4

# Concat 4x5 with packshot
ffmpeg -y \
  -i output/scene01/captioned_4x5.mp4 \
  -i media/Packshot_9_16.mp4 \
  -filter_complex "\
    [0:v]fps=24[v0]; \
    [1:v]fps=24,scale=1080:1350:force_original_aspect_ratio=increase,crop=1080:1350[v1]; \
    [v0][0:a][v1][1:a]concat=n=2:v=1:a=1[outv][outa]" \
  -map "[outv]" -map "[outa]" \
  -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k \
  output/scene01/final_4x5.mp4
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
