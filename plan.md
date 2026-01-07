# Photify AI - Concept 4: Animated Family Photos

## Overview
Create 15 video creatives showing "talking heads" emotionally reacting to animated vintage family photos. Each video uses the same 5 animated retro photos as background, with different characters wiping away tears.

## Deliverables per video
- 2 formats: 4x5 (1080x1350) + 9x16 (1080x1920)
- CapCut-style dynamic subtitles
- Background music/sfx
- Packshot at end: `media/Packshot_9_16.mp4`

## Assets Generated

### 1. Animated Retro Photos (5 total, shared across all videos)
| # | Description | Image | Video |
|---|-------------|-------|-------|
| 1 | Young grandparents sitting side by side, holding hands | `media/retro/01_grandparents.jpg` | `media/retro/01_grandparents.mp4` |
| 2 | Woman holding cat, cat rubbing against her hand | `media/retro/02_woman_cat.jpg` | `media/retro/02_woman_cat.mp4` |
| 3 | New Year by old tree, two kids in costumes | `media/retro/03_newyear.jpg` | `media/retro/03_newyear.mp4` |
| 4 | Old person on porch of old house | `media/retro/04_elderly_porch.jpg` | `media/retro/04_elderly_porch.mp4` |
| 5 | Family dinner gathering | `media/retro/05_family_dinner.jpg` | `media/retro/05_family_dinner.mp4` |

### 2. Talking Head Characters (15 total)
| # | Description | Portrait | Greenscreen |
|---|-------------|----------|-------------|
| 1 | Girl with long light brown hair (25-30) | `media/characters/01_light_brown_hair.jpg` | `media/characters/01_light_brown_hair_greenscreen.jpg` |
| 2 | Asian girl with short black hair and bangs | `media/characters/02_asian_bangs.jpg` | `media/characters/02_gs.jpg` |
| 3 | Girl with red curls and freckles | `media/characters/03_red_curls.jpg` | `media/characters/03_gs.jpg` |
| 4 | Girl with bright colored hair (pink/blue) | `media/characters/04_pink_hair.jpg` | `media/characters/04_gs.jpg` |
| 5 | Girl with bangs and long dark hair | `media/characters/05_dark_bangs.jpg` | `media/characters/05_gs.jpg` |
| 6 | Middle-aged woman with gray streaks | `media/characters/06_gray_streaks.jpg` | `media/characters/06_gs.jpg` |
| 7 | Girl with soft curls, warm skin tone | `media/characters/07_soft_curls.jpg` | `media/characters/07_gs.jpg` |
| 8 | Girl with shaved side, asymmetric cut | `media/characters/08_shaved_side.jpg` | `media/characters/08_gs.jpg` |
| 9 | Dark-skinned girl with afro curls | `media/characters/09_afro_curls.jpg` | `media/characters/09_gs.jpg` |
| 10 | Girl with long braids or dreads | `media/characters/10_long_braids.jpg` | `media/characters/10_gs.jpg` |
| 11 | Girl with glasses, bob haircut | `media/characters/11_glasses_bob.jpg` | `media/characters/11_gs.jpg` |
| 12 | Young girl with short cut, septum piercing | `media/characters/12_septum.jpg` | `media/characters/12_gs.jpg` |
| 13 | Girl with super long platinum white hair | `media/characters/13_platinum_hair.jpg` | `media/characters/13_gs.jpg` |
| 14 | Asian woman with neat haircut, glasses | `media/characters/14_asian_glasses.jpg` | `media/characters/14_gs.jpg` |
| 15 | Dark-skinned girl with wavy pink hair | `media/characters/15_pink_wig.jpg` | `media/characters/15_gs.jpg` |

### 3. Audio Assets
| Asset | File | Duration |
|-------|------|----------|
| Voice (Rachel) | `output/scene01/voice.mp3` | ~7 seconds |
| Captions SRT | `output/scene01/captions.srt` | 0-5 seconds |

### 4. Packshot
| Format | File | Duration |
|--------|------|----------|
| 9x16 | `media/Packshot_9_16.mp4` | 2.18s |
| 4x5 | `media/Packshot_4x5.mp4` | 2.18s (created from 9x16) |

---

## Script
**Voice:** "Guys... I animated old family photos with Photify, and realized my great-grandma had the exact same smile as me."

**Action:** Character wipes tears (touched, not overly dramatic)

---

## Captions SRT Format
```srt
1
00:00:00,000 --> 00:00:01,500
Guys...

2
00:00:01,500 --> 00:00:03,500
I animated old family photos
with Photify

3
00:00:03,500 --> 00:00:05,000
and realized my great-grandma
had the exact same smile as me
```

---

## FINAL WORKING COMMANDS (Scene 01)

### Step 1: Generate Lipsync Video
```bash
bun run src/cli/index.ts run sync \
  --image media/characters/01_light_brown_hair_greenscreen.jpg \
  --audio output/scene01/voice.mp3 \
  --prompt "woman speaking emotionally, warm expression" \
  --duration 10 \
  --resolution 720p \
  --quiet
```

**Output:** `output/scene01/talking_head_v2.mp4` (10 seconds, greenscreen background)

### Step 2: Composite 9x16 (1080x1920)
```bash
ffmpeg -y \
  -i media/retro/01_grandparents.mp4 \
  -stream_loop 1 -i media/retro/01_grandparents.mp4 \
  -i output/scene01/talking_head_v2.mp4 \
  -filter_complex "\
    [0:v][1:v]concat=n=2:v=1:a=0[bglong]; \
    [bglong]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[bg]; \
    [2:v]chromakey=0x00ff00:0.3:0.1,crop=600:700:250:50,scale=420:-1[fg]; \
    [bg][fg]overlay=(W-w)/2:H-h-650[out]" \
  -map "[out]" -map 2:a -t 7 output/scene01/composite_9x16.mp4
```

**Key parameters for 9x16:**
- `scale=420:-1` - talking head width (420px, larger)
- `H-h-650` - position from bottom (650px up = upper-middle area)
- `crop=600:700:250:50` - crop talking head video (600x700, offset 250,50 to center on face)

### Step 3: Add Captions to 9x16
```bash
ffmpeg -y -i output/scene01/composite_9x16.mp4 \
  -vf "subtitles=/Users/aleks/Github/varghq/sdk/output/scene01/captions.srt:force_style='FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=2,Bold=1,Alignment=2,MarginV=15'" \
  -c:a copy output/scene01/captioned_9x16.mp4
```

**Key parameters:**
- `FontSize=18` - smaller font (standard for social media)
- `MarginV=15` - 15px from bottom edge
- `Alignment=2` - bottom center
- **MUST use absolute path for subtitles file**

### Step 4: Add Packshot to 9x16
```bash
ffmpeg -y -i output/scene01/captioned_9x16.mp4 -i media/Packshot_9_16.mp4 \
  -filter_complex "[0:v]fps=24[v0];[1:v]fps=24[v1];[v0][0:a][v1][1:a]concat=n=2:v=1:a=1[outv][outa]" \
  -map "[outv]" -map "[outa]" output/scene01/final_9x16_v4.mp4
```

### Step 5: Composite 4x5 (1080x1350)
```bash
ffmpeg -y \
  -i media/retro/01_grandparents.mp4 \
  -stream_loop 1 -i media/retro/01_grandparents.mp4 \
  -i output/scene01/talking_head_v2.mp4 \
  -filter_complex "\
    [0:v][1:v]concat=n=2:v=1:a=0[bglong]; \
    [bglong]scale=1080:1350:force_original_aspect_ratio=increase,crop=1080:1350,setsar=1[bg]; \
    [2:v]chromakey=0x00ff00:0.3:0.1,crop=600:700:250:50,scale=420:-1[fg]; \
    [bg][fg]overlay=(W-w)/2:H-h-550[out]" \
  -map "[out]" -map 2:a -t 7 output/scene01/composite_4x5.mp4
```

**Key parameters for 4x5:**
- `scale=420:-1` - same talking head width
- `H-h-550` - position from bottom (550px up for shorter frame)
- Background scales to 1080x1350 instead of 1920

### Step 6: Add Captions to 4x5
```bash
ffmpeg -y -i output/scene01/composite_4x5.mp4 \
  -vf "subtitles=/Users/aleks/Github/varghq/sdk/output/scene01/captions.srt:force_style='FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=2,Bold=1,Alignment=2,MarginV=15'" \
  -c:a copy output/scene01/captioned_4x5.mp4
```

### Step 7: Create 4x5 Packshot (one-time)
```bash
ffmpeg -y -i media/Packshot_9_16.mp4 \
  -vf "scale=1080:1350:force_original_aspect_ratio=increase,crop=1080:1350" \
  -c:a copy media/Packshot_4x5.mp4
```

### Step 8: Add Packshot to 4x5
```bash
ffmpeg -y -i output/scene01/captioned_4x5.mp4 -i media/Packshot_4x5.mp4 \
  -filter_complex "[0:v]fps=24[v0];[1:v]fps=24[v1];[v0][0:a][v1][1:a]concat=n=2:v=1:a=1[outv][outa]" \
  -map "[outv]" -map "[outa]" output/scene01/final_4x5_v4.mp4
```

---

## CRITICAL LESSONS LEARNED

### 1. Subtitles Filter Issues
- **MUST use absolute path** for subtitle file: `subtitles=/full/path/to/captions.srt`
- Relative paths like `subtitles='output/scene01/captions.srt'` may silently fail
- MarginV is distance from BOTTOM edge when Alignment=2

### 2. Talking Head Positioning
- **9x16 (1920 height):** Use `H-h-650` to position character in upper-middle
- **4x5 (1350 height):** Use `H-h-550` for similar visual position
- Character should be ABOVE captions, not overlapping
- Larger head size (420px width) looks better than smaller (260-320px)

### 3. Caption Positioning
- **FontSize=18** is good for social media (not too big, not too small)
- **MarginV=15** places captions at very bottom
- Higher MarginV values push captions UP (e.g., MarginV=500 = 500px from bottom)
- For 4x5, use same MarginV as 9x16 since captions should be at bottom in both

### 4. Chromakey Settings
- `chromakey=0x00ff00:0.3:0.1` works well for bright green backgrounds
- 0x00ff00 = pure green
- 0.3 = similarity threshold
- 0.1 = blend/edge softness

### 5. Crop for Face Focus
- `crop=600:700:250:50` crops the lipsync video to focus on face
- Format: `crop=width:height:x_offset:y_offset`
- Adjust x_offset and y_offset based on face position in source video

### 6. Background Looping
- Use `-stream_loop 1` to loop short backgrounds
- Animated photos are ~5 seconds, need ~7 seconds for full audio
- Concat looped background before compositing

### 7. FPS Alignment for Concat
- Both videos must have same FPS for clean concat
- Use `fps=24` filter on both before concat
- Packshot may be 60fps, main content is 24fps

### 8. Color Format for ASS Styles
- Use `&H00FFFFFF` format (AABBGGRR in hex)
- `&H00FFFFFF` = white
- `&H00000000` = black
- The `00` prefix is alpha (00 = opaque)

---

## Scene 01 Final Output

| Format | File | Resolution | Duration |
|--------|------|------------|----------|
| 9x16 | `output/scene01/final_9x16_v4.mp4` | 1080x1920 | ~9.2s |
| 4x5 | `output/scene01/final_4x5_v4.mp4` | 1080x1350 | ~9.2s |

---

## Remaining Work

### Scenes 02-15
Each scene needs:
1. Generate lipsync video using greenscreen character image
2. Create composite (9x16 and 4x5)
3. Add captions
4. Add packshot
5. Export finals

### Batch Processing Template
```bash
# For each scene N (02-15):
SCENE="02"
CHAR_IMG="media/characters/02_gs.jpg"
BG_VIDEO="media/retro/02_woman_cat.mp4"

# Create scene folder
mkdir -p output/scene${SCENE}
cp output/scene01/voice.mp3 output/scene${SCENE}/
cp output/scene01/captions.srt output/scene${SCENE}/

# Generate lipsync
bun run src/cli/index.ts run sync \
  --image ${CHAR_IMG} \
  --audio output/scene${SCENE}/voice.mp3 \
  --prompt "woman speaking emotionally, warm expression" \
  --duration 10 \
  --resolution 720p \
  --output output/scene${SCENE}/talking_head.mp4

# Then run composite/caption/packshot commands as above
```

---

## Cost Tracking

| Item | Cost |
|------|------|
| Flux Pro images (5 retro + 15 chars + 15 greenscreen) | ~$0.80 |
| Kling video (5 animations) | ~$2.10 |
| Wan-25 lipsync (1 so far) | ~$0.50 |
| ElevenLabs TTS | ~$0.05 |
| **Total so far** | **~$3.45** |

Estimated for all 15 scenes: ~$10-12 total
