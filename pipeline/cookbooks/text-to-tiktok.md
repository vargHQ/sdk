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

---

# helper scripts

scripts in `pipeline/cookbooks/scripts/` to speed up common tasks:

| script | description | usage |
|--------|-------------|-------|
| `generate-frames-parallel.ts` | generate multiple scene frames in parallel using flux kontext | `bun run pipeline/cookbooks/scripts/generate-frames-parallel.ts` |
| `animate-frames-parallel.ts` | animate multiple frames in parallel using kling | `bun run pipeline/cookbooks/scripts/animate-frames-parallel.ts` |
| `combine-scenes.sh` | combine scene videos with audio clips using ffmpeg | `./pipeline/cookbooks/scripts/combine-scenes.sh media/your-project` |
| `still-to-video.sh` | convert still image to video with ken burns effect | `./pipeline/cookbooks/scripts/still-to-video.sh input.jpg output.mp4 5 in` |

**generate-frames-parallel.ts** - edit the `configs` array to define your scenes, supports single character (kontext) and multi-character (kontext/multi) frames.

**animate-frames-parallel.ts** - edit the `configs` array with frame paths and prompts. all kling requests run in parallel.

**combine-scenes.sh** - edit the `SCENES` array to define scene timing. handles audio extraction, video looping, and concatenation.

**still-to-video.sh** - useful when kling fails or for simple scenes. creates slow zoom (ken burns) effect from a still frame.

---

# advanced: character-based storytelling videos

for narrative content with consistent characters (like animated story videos)

## character generation

### generate consistent characters with nano banana pro

```bash
# protagonist (male)
bun run lib/fal.ts generate_image "3D cartoon anthropomorphic male cat character, cute stylized, standing pose, young adult male energy, slightly guarded but hopeful expression, big expressive eyes, wearing hoodie and jeans, muted earth tones, pixar dreamworks style, full body shot, white background, character reference sheet" "fal-ai/nano-banana-pro" "portrait_16_9"

# love interest (female)  
bun run lib/fal.ts generate_image "3D cartoon anthropomorphic female cat character, cute stylized, standing pose, mature confident woman energy, warm loving expression, big expressive eyes, wearing elegant but casual dress, warm colors, pixar dreamworks style, full body shot, white background, character reference sheet" "fal-ai/nano-banana-pro" "portrait_16_9"
```

save as `cat_protagonist.png`, `cat_love_interest.png`, etc.

## video generation models comparison

### for character consistency (multiple characters in one scene)

| model | reference support | best for |
|-------|------------------|----------|
| **veo3.1/reference-to-video** | multiple `image_urls` | best character consistency across multiple refs |
| **vidu/q2/reference-to-video** | up to 7 `reference_image_urls` | good consistency (had api issues) |
| **bytedance/lynx** | subject reference | designed for subject consistency |

### for single character animation

| model | notes |
|-------|-------|
| **kling-video/v2.5-turbo/pro** | reliable, good motion, supports `tail_image_url` for loops |
| **sora-2/image-to-video** | up to 12 sec, great quality, no reference support |
| **veo3.1/image-to-video** | good quality, uses image as literal first frame |

## workflow: scene-by-scene generation

### step 1: create scene script with timestamps

use the SRT file to understand timing:
```bash
head -50 media/your-project/captions.srt
```

create a scene breakdown markdown file (`scene_script.md`):

```markdown
# Scene Script - Cat Story (2:56 total)

Characters:
- **Protagonist** (male cat in hoodie) - the "you/brother"
- **First Girl** (young playful female cat in pastel) - the immature one
- **Second Girl/Amelia** (mature elegant female cat in orange) - "The One"

All scenes: 9:16 portrait, pixar 3d style, no talking/lip movement, cinematic

---

## Scene 1: Title/Hook (0:00-0:03)
**Text:** "How a girl that didn't love you ruined your future marriage"
**Visual:** Protagonist cat sitting alone on a bench at night, city lights behind, looking down sadly.
**Duration:** 3 sec

## Scene 2: Young Love (0:03-0:09)
**Text:** "When you were young, you fell in love..."
**Visual:** Protagonist and First Girl walking together in a park, sunny day.
**Duration:** 6 sec

## Scene 7: Flashback (0:54-1:01)
**Text:** "...your training kicks in..."
**Visual:** FLASHBACK - reuse Scene 5 video in B&W jittery style
**Duration:** 6.5 sec
```

key tips:
- include character descriptions at top
- note when to reuse videos (flashbacks, repeated scenes)
- specify visual style effects (B&W, jitter, etc)
- include exact timestamps from SRT

### step 2: generate scene frames with flux kontext

**important:** veo3.1 image-to-video uses the reference as the literal first frame. generate proper scene frames first!

**use the helper script for parallel generation:**
```bash
# edit the configs in the script first, then run:
bun run pipeline/cookbooks/scripts/generate-frames-parallel.ts
```

or manually:
```typescript
import { fal } from "@fal-ai/client";

// upload character reference
const protagonist = await fal.storage.upload(Bun.file("media/your-project/cat_protagonist.png"));

// use flux kontext to place character in scene
const result = await fal.subscribe("fal-ai/flux-pro/kontext", {
  input: {
    prompt: "Place this 3D cartoon cat character sitting alone on a park bench at night, city lights bokeh in background, looking down sadly, melancholy mood, cinematic lighting, pixar style, 9:16 portrait vertical composition",
    image_url: protagonist,
    aspect_ratio: "9:16"
  }
});
```

### step 3: animate frames with kling

**use the helper script for parallel animation:**
```bash
# edit the configs in the script first, then run:
bun run pipeline/cookbooks/scripts/animate-frames-parallel.ts
```

or manually:
```typescript
const result = await fal.subscribe("fal-ai/kling-video/v2.5-turbo/pro/image-to-video", {
  input: {
    prompt: "3D pixar animation, the cat character sits still on bench looking down sadly, subtle breathing movement, city lights twinkle softly in background, slow gentle camera push in, melancholy cinematic mood, no talking",
    image_url: sceneFrameUrl,
    duration: "5",
    aspect_ratio: "9:16"
  }
});
```

**for static frames (ken burns effect):**
```bash
# convert still image to video with slow zoom
./pipeline/cookbooks/scripts/still-to-video.sh media/your-project/scene1_frame.jpg media/your-project/scene1_video.mp4 5 in
```

### step 4: for scenes with multiple characters

use veo3.1 reference-to-video:

```typescript
const result = await fal.subscribe("fal-ai/veo3.1/reference-to-video", {
  input: {
    prompt: "3D pixar style animation, two anthropomorphic cats walking together in a sunny park - male cat looks at female cat with love, she looks distracted, sunny golden hour lighting, no talking",
    image_urls: [protagonistUrl, loveInterestUrl],
    duration: "8s",
    resolution: "720p",
    generate_audio: false
  }
});
```

### step 5: assemble with remotion

after generating all scene videos, use remotion for final assembly:

```bash
# copy all scene videos to remotion public folder
cp media/your-project/scene*_video.mp4 lib/remotion/public/your-project/
cp media/your-project/voiceover.mp3 lib/remotion/public/your-project/

# create composition
bun run lib/remotion/index.ts create YourProject

# edit composition with scene timeline (see remotion workflow section)
# preview in studio
bun remotion studio lib/remotion/compositions/YourProject.root.tsx --public-dir=lib/remotion/public

# render
bun remotion render lib/remotion/compositions/YourProject.root.tsx YourProject final.mp4 --public-dir=lib/remotion/public
```

**alternative: simple ffmpeg assembly (no captions styling):**
```bash
# use the combine-scenes script
./pipeline/cookbooks/scripts/combine-scenes.sh media/your-project
```

## tips for character videos

### no talking/lip sync
- prompt with "no talking", "no lip movement", "silent"
- characters express emotion through body language
- voiceover is added in post

### portrait format (9:16)
- flux kontext supports `aspect_ratio: "9:16"`
- kling supports `aspect_ratio: "9:16"`
- veo3.1 reference-to-video outputs landscape by default (16:9)

### scene continuity
- keep same character references across all scenes
- use similar lighting descriptions ("cinematic", "golden hour", "moody blue")
- match camera style ("slow push in", "static shot")

### stitching scenes (simple ffmpeg)
```bash
# create file list
echo "file 'scene1.mp4'" > scenes.txt
echo "file 'scene2.mp4'" >> scenes.txt
echo "file 'scene3.mp4'" >> scenes.txt

# concatenate
ffmpeg -f concat -safe 0 -i scenes.txt -c copy combined_scenes.mp4
```

### stitching scenes (remotion - recommended)
use remotion for more control:
- reuse same video in multiple scenes (flashbacks)
- add effects (B&W, jitter for flashbacks)
- tiktok-style word-by-word captions
- named sequences visible in studio

```typescript
// separate video file from scene id - allows reuse
const SCENES = [
  { id: 1, video: 1, name: "1. Title", start: 0, duration: 3.5 },
  { id: 7, video: 5, name: "7. Flashback", start: 54.5, duration: 6.5, flashback: true },
  { id: 12, video: 13, name: "12. Years Pass", start: 120, duration: 15 },
  { id: 14, video: 13, name: "14. His Love", start: 155, duration: 10 }, // same video!
];
```

### flashback effect
for memory/past scenes, add B&W + jitter:
```typescript
const flashbackStyle = flashback ? {
  filter: "grayscale(100%) contrast(1.2) brightness(0.9)",
  transform: `translate(${Math.sin(frame * 0.5) * 2}px, ${Math.cos(frame * 0.7) * 1.5}px)`,
} : {};
```

### video looping (critical!)
when scene duration > video duration, video freezes on last frame. fix with `<Loop>`:

```typescript
import { Loop } from "remotion";

// define actual video file durations (from ffprobe)
const VIDEO_DURATIONS_SECONDS: Record<number, number> = {
  1: 5.041667,
  2: 10.041667,
  3: 5.041667,
  // ... etc
};

// looping video component
const LoopingVideo: React.FC<{
  src: string;
  flashback?: boolean;
  loopDurationInFrames: number;
}> = ({ src, flashback, loopDurationInFrames }) => {
  const frame = useCurrentFrame();
  
  const flashbackStyle = flashback ? {
    filter: "grayscale(100%) contrast(1.2) brightness(0.9)",
    transform: `translate(${Math.sin(frame * 0.5) * 2}px, ${Math.cos(frame * 0.7) * 1.5}px)`,
  } : {};

  return (
    <Loop durationInFrames={loopDurationInFrames}>
      <OffthreadVideo src={src} style={{ ...flashbackStyle }} muted />
    </Loop>
  );
};

// usage: pass video's actual duration, not scene duration
const loopDuration = VIDEO_DURATIONS_SECONDS[scene.video];
const loopDurationInFrames = Math.round(loopDuration * fps);

<LoopingVideo
  src={staticFile(`scene${scene.video}_video.mp4`)}
  loopDurationInFrames={loopDurationInFrames}
/>
```

**key insight**: `<Loop durationInFrames>` needs the VIDEO's duration, not the scene's duration. the video loops within the scene's timeframe.

### get video durations
```bash
# probe all scene videos
for f in lib/remotion/public/your-project/scene*_video.mp4; do
  echo -n "$(basename $f): "
  ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$f"
done
```

## project structure for character videos

```
media/your-project/
├── post.md                    # script/text
├── scene_script.md            # scene breakdown with timestamps
├── characters/
│   ├── cat_protagonist.png    # character reference
│   ├── cat_first_girl.png
│   └── cat_second_girl.png
├── frames/
│   ├── scene1_frame.jpg       # generated scene frames
│   ├── scene2_frame.jpg
│   └── ...
├── scenes/
│   ├── scene1.mp4             # animated scenes
│   ├── scene2.mp4
│   └── ...
├── voiceover.mp3
├── captions.srt
└── final.mp4
```

---

## remotion workflow (advanced: beautiful tiktok-style captions)

for professional captions with word-by-word highlighting, use remotion instead of ffmpeg:

### step 1: copy assets to remotion public folder

```bash
mkdir -p lib/remotion/public/your-project
cp media/your-project/*.mp4 lib/remotion/public/your-project/
cp media/your-project/voiceover.mp3 lib/remotion/public/your-project/
```

### step 2: create remotion composition

```bash
bun run lib/remotion/index.ts create YourProject
```

### step 3: edit composition with scene timeline

key features:
- **named sequences** - each scene gets a name visible in Studio
- **separate video id from scene id** - allows reusing videos (flashbacks, repeated scenes)
- **flashback effects** - B&W + jitter for memory/past scenes
- **tiktok captions** - word-by-word highlighting with active word glow

example scene structure:
```typescript
const SCENES = [
  // protagonist alone on bench at night
  { id: 1, video: 1, name: "1. Title/Hook", start: 0, duration: 3.5 },
  
  // flashback - reuse scene 5 with B&W effect
  { id: 7, video: 5, name: "7. Flashback", start: 54.5, duration: 6.5, flashback: true },
  
  // same video used in multiple places
  { id: 12, video: 13, name: "12. Years Pass", start: 120, duration: 15 },
  { id: 14, video: 13, name: "14. His Love", start: 155, duration: 10 },
];
```

### step 4: preview with remotion studio

```bash
bun remotion studio lib/remotion/compositions/YourProject.root.tsx --public-dir=lib/remotion/public
```

studio features:
- scrub through timeline
- see all named sequences
- debug timing issues
- preview before rendering

### step 5: render

```bash
# quick preview (480p)
bun remotion render lib/remotion/compositions/YourProject.root.tsx YourProject preview.mp4 --public-dir=lib/remotion/public --scale=0.5

# full quality
bun remotion render lib/remotion/compositions/YourProject.root.tsx YourProject final.mp4 --public-dir=lib/remotion/public
```

### remotion vs ffmpeg

| feature | ffmpeg | remotion |
|---------|--------|----------|
| basic captions | yes (ASS/SRT) | yes |
| word-by-word highlight | limited | excellent |
| flashback effects | complex filters | simple CSS |
| scene names/debugging | none | Studio UI |
| reusing videos | manual | easy (video != id) |
| transitions | complex | built-in |
| render time | fast | slower |

**use ffmpeg** for simple overlays, **use remotion** for polished tiktok-style videos

### embedding SRT in composition

avoid file loading issues by embedding SRT content directly:

```typescript
// paste SRT content directly in file
const SRT_CONTENT = `1
00:00:00,071 --> 00:00:00,291
How

2
00:00:00,291 --> 00:00:00,351
a
...`;

// parse once at module level
const CAPTIONS = parseSRT(SRT_CONTENT);
```

see `lib/remotion/SKILL.md` for full caption implementation
