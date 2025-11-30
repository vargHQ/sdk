# text to tiktok pipeline

turn text (reddit post, script, etc) into a tiktok with ai-generated looping background and voiceover

## overview

1. generate voiceover from text (elevenlabs)
2. get word-level timestamps (fireworks whisper)
3. generate looping background video (kling on fal.ai)
4. combine with captions (ffmpeg)

## step 1: prepare content

```bash
mkdir -p media/your-project
```

put your text in `media/your-project/post.md`

## step 2: generate voiceover

**important:** strip markdown formatting (like `#`) before sending to elevenlabs - it will read them aloud!

```bash
# sam voice - relaxed male (good for philosophical/alan watts style content)
TEXT=$(cat media/your-project/post.md | sed 's/^# //')
bun run lib/elevenlabs.ts tts "$TEXT" sam media/your-project/voiceover.mp3
```

voice options:
- `sam` - relaxed american male (best for philosophical/calm content)
- `adam` - deep american male (more intense/pushy)
- `antoni` - mature male
- `josh` - american male
- `rachel` - american female

model used: `eleven_multilingual_v2`

check duration:
```bash
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 media/your-project/voiceover.mp3
```

## step 3: get word timestamps

```bash
bun run lib/fireworks.ts media/your-project/voiceover.mp3 media/your-project/segments.json
```

outputs json with word-level timestamps for captions.

## step 4: generate looping background video

### 4a: generate first frame with motion (important for loops)

for driving/movement scenes, bake motion blur into the first frame so the video starts already moving:

```bash
bun run lib/fal.ts generate_image "POV from inside moving car driving through rainy city at night, motion blur on streetlights and neon signs, raindrops streaking on windshield from speed, dashboard visible at bottom, blurred city lights rushing past, cinematic motion blur, photorealistic" "fal-ai/flux-pro/v1.1" "portrait_16_9"
```

download and save to `media/your-project/frame.jpg`

### 4b: generate looping video with tail_image_url

use the same image for start and end frame to create seamless loop:

```typescript
import { imageToVideo } from "./lib/fal.ts";

const result = await imageToVideo({
  prompt: "POV from inside car driving through rainy city at night, continuous forward motion, passing neon signs and streetlights, raindrops streaming on windshield, steady driving pace, seamless loop",
  imageUrl: "media/your-project/frame.jpg",
  tailImageUrl: "media/your-project/frame.jpg", // same as start = loop!
  duration: 10,
});
```

### 4c: extend to full length

loop the 10sec clip to match voiceover duration:

```bash
# for 3 min voiceover, loop ~18 times
ffmpeg -y -stream_loop 17 -i media/your-project/bg_10sec.mp4 -t 180 -c copy media/your-project/bg_full.mp4
```

## step 5: combine video + audio + captions + screenshot overlay

combine everything with optional screenshot overlay for first few seconds:

```bash
ffmpeg -y \
  -i media/your-project/bg_full.mp4 \
  -i media/your-project/voiceover.mp3 \
  -loop 1 -t 4 -i media/your-project/screenshot.png \
  -filter_complex "\
    [2:v]scale=900:-1,format=yuva420p,fade=t=out:st=3:d=1:alpha=1[screenshot]; \
    [0:v][screenshot]overlay=(W-w)/2:(H-h)/2:shortest=0:eof_action=pass[vbase]; \
    [vbase]subtitles=media/your-project/captions.srt:force_style='FontName=Arial,FontSize=20,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,Bold=-1,Alignment=2,MarginV=60,Outline=3'[vout]" \
  -map "[vout]" -map 1:a \
  -c:v libx264 -preset faster -crf 20 \
  -c:a aac -b:a 128k \
  -shortest \
  -movflags +faststart \
  media/your-project/final.mp4
```

this command:
- overlays screenshot for first 4 seconds with fade out
- adds word-by-word SRT captions
- combines background video + voiceover audio

### simpler version (no screenshot overlay)

```bash
ffmpeg -y -i media/your-project/bg_full.mp4 \
  -i media/your-project/voiceover.mp3 \
  -vf "subtitles=media/your-project/captions.srt:force_style='FontName=Arial,FontSize=20,Bold=-1,Outline=3'" \
  -c:v libx264 -preset faster -crf 20 \
  -c:a aac -b:a 128k \
  -shortest \
  -movflags +faststart \
  media/your-project/final.mp4
```

## tips for looping backgrounds

### prompt tips for seamless loops
- "continuous forward motion" - keeps direction consistent
- "seamless loop" - hints at looping intent
- "steady pace" - avoids acceleration/deceleration
- "never stops" - prevents pausing

### motion blur in first frame
if your scene has movement (driving, walking, flying), generate the first frame WITH motion blur. otherwise kling will animate from a still start.

bad: "car on rainy street" (static frame = car starts from stop)
good: "moving car, motion blur on lights, raindrops streaking" (motion frame = already driving)

### use tail_image_url for loops
kling's `tail_image_url` parameter forces the video to end on a specific frame. set it to the same as `image_url` to create a seamless loop.

### background ideas that loop well
- driving POV (city, highway, rain)
- walking POV (city streets, forest path)
- clouds/sky timelapse
- ocean waves
- abstract particles/smoke

### backgrounds that DON'T loop well
- scenes with specific landmarks
- conversations/interactions
- anything with a narrative arc

## tips for text prep

### strip markdown before tts
elevenlabs reads markdown literally - `# heading` becomes "hashtag heading". always strip:

```bash
TEXT=$(cat post.md | sed 's/^# //')
```

### run grammar check
before generating voiceover, check for:
- typos ("she'll met" vs "she'll meet")
- missing apostrophes ("its" vs "it's")
- repeated words ("into to")
- missing commas ("After all she" vs "After all, she")

## example project structure

```
media/your-project/
├── post.md              # original text
├── voiceover.mp3        # elevenlabs output
├── segments.json        # word timestamps
├── frame.jpg            # first frame (with motion blur)
├── bg_10sec.mp4         # 10sec looping clip
├── bg_full.mp4          # extended to voiceover length
├── subtitles.ass        # generated captions
└── final.mp4            # final tiktok
```

## full example: philosophical reddit post

```bash
# 1. voiceover (strip markdown, use relaxed sam voice)
TEXT=$(cat media/girl-ruined-you/post.md | sed 's/^# //')
bun run lib/elevenlabs.ts tts "$TEXT" sam media/girl-ruined-you/voiceover.mp3

# 2. get word timestamps for captions (outputs .srt)
bun run lib/fireworks.ts media/girl-ruined-you/voiceover.mp3 media/girl-ruined-you/captions.srt

# 3. first frame with motion blur
bun run lib/fal.ts generate_image "POV from inside moving car driving through rainy city at night, motion blur on streetlights, raindrops streaking on windshield, cinematic" "fal-ai/flux-pro/v1.1" "portrait_16_9"

# 4. looping video (run as ts script for tail_image_url)
# see step 4b above

# 5. extend loop to match voiceover duration
ffmpeg -y -stream_loop 17 -i media/girl-ruined-you/bg_car_final.mp4 -t 177 -c copy media/girl-ruined-you/bg_full.mp4

# 6. combine with screenshot overlay + captions
ffmpeg -y \
  -i media/girl-ruined-you/bg_full.mp4 \
  -i media/girl-ruined-you/voiceover.mp3 \
  -loop 1 -t 4 -i media/girl-ruined-you/shot.png \
  -filter_complex "\
    [2:v]scale=900:-1,format=yuva420p,fade=t=out:st=3:d=1:alpha=1[screenshot]; \
    [0:v][screenshot]overlay=(W-w)/2:(H-h)/2:shortest=0:eof_action=pass[vbase]; \
    [vbase]subtitles=media/girl-ruined-you/captions.srt:force_style='FontName=Arial,FontSize=20,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,Bold=-1,Alignment=2,MarginV=60,Outline=3'[vout]" \
  -map "[vout]" -map 1:a \
  -c:v libx264 -preset faster -crf 20 \
  -c:a aac -b:a 128k \
  -shortest \
  -movflags +faststart \
  media/girl-ruined-you/final_with_captions.mp4
```

## alternative: minecraft/subway surfers background

if you have a minecraft parkour or subway surfers video:

```bash
# loop existing background video
ffmpeg -stream_loop -1 -i media/backgrounds/minecraft_parkour.mp4 \
  -i media/your-project/voiceover.mp3 \
  -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" \
  -c:v libx264 -preset faster -crf 23 \
  -c:a aac -b:a 128k \
  -shortest \
  -movflags +faststart \
  media/your-project/final.mp4
```

note: yt-dlp currently broken for youtube downloads. use cobalt.tools or screen record instead.
