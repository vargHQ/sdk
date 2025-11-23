# wan 2.5 talking character cookbook

create realistic talking character videos: person in a setting speaking with natural voice and lipsync

## what this does

1. generates first frame: person in specified setting (conference, station, etc)
2. generates voiceover from text script
3. creates talking video using wan 2.5 with audio sync

## inputs

- `text_script`: what the person will say
- `profile_photo`: photo of the person (e.g., media/friend/katia.jpg)
- `scene_location`: where they are (from script or default: conference/underground station)

## steps

### step 1: generate first frame (person in setting)

use nano banana pro image-to-image to place the person into the desired setting while preserving their face and aspect ratio:

```bash
# generate first frame using nano banana pro image-to-image
# aspect_ratio "auto" preserves the original photo's aspect ratio (portrait/landscape)
bun run lib/fal.ts image_to_image \
  "woman at busy conference hall with people walking in background, professional casual setting, natural lighting" \
  media/friend/katia.jpg \
  auto
```

**important**: aspect ratio "auto" preserves the original photo dimensions - critical for avoiding squashed/stretched video output!

the output will include a URL like: `https://v3b.fal.media/files/.../image.jpg`

optionally download to save locally:
```bash
curl -o media/friend/first-frame.jpg "https://fal-output-url.jpg"
```

### step 2: generate voiceover

```bash
# generate voice from script
bun run lib/elevenlabs.ts tts \
  "hey everyone! excited to share this update from the conference" \
  rachel \
  output/voice.mp3
```

the audio is saved to `output/voice.mp3`. you'll need to upload this to get a url for wan 2.5.

### step 3: upload audio to get url

wan 2.5 needs the audio as a url. use fal storage:

```bash
# create a small script to upload
cat > /tmp/upload-audio.ts << 'EOF'
import { fal } from "@fal-ai/client";

const file = await Bun.file("output/voice.mp3").arrayBuffer();
const uploadedUrl = await fal.storage.upload(
  new Blob([file], { type: "audio/mpeg" })
);

console.log(uploadedUrl);
EOF

bun /tmp/upload-audio.ts
```

this outputs a url like: `https://v3b.fal.media/files/.../audio.mpeg`

now you have:
- image_url: from step 1
- audio_url: from this step

### step 4: generate talking video with wan 2.5

```bash
# run wan 2.5 with the image and audio urls
# prompt should describe the video style and setting
# duration MUST be 5 or 10 seconds only (not 15, 20, etc)
bun run lib/replicate.ts wan \
  https://v3b.fal.media/files/.../first-frame.jpg \
  https://v3b.fal.media/files/.../audio.mpeg \
  "handheld iphone selfie video, woman talking to camera in busy conference hall, natural shaky camera movement" \
  10 \
  480p
```

**prompt tips for natural look:**
- include "handheld iphone selfie video" for realistic camera shake
- add "shaky camera" or "natural camera movement" for authenticity
- mention the setting to match step 1 (conference hall, metro station, etc)

this takes 3-5 minutes. the command will wait for completion.

alternatively, if it times out, check prediction history:
```bash
# list recent predictions
bun run lib/replicate.ts list

# get specific prediction by id
bun run lib/replicate.ts get <prediction-id>
```

### step 5: download result

```bash
# wan 2.5 returns video url like: https://replicate.delivery/.../video.mp4
curl -o media/friend/talking-character.mp4 "https://replicate.delivery/.../video.mp4"
```

## output

- first frame: person in setting (jpg)
- voiceover: `output/voice.mp3`
- final video: `output/talking-character.mp4`

## timing

- first frame generation: 5-10s
- voiceover: 5-10s
- wan 2.5 processing: 3-5min

**total: ~5 minutes**

## scene context examples

choose setting based on script context. always include handheld camera description for authentic look:

| script mentions | wan 2.5 prompt example |
|----------------|------------------------|
| "at the conference" | handheld iphone selfie, woman talking to camera in busy conference hall, natural shaky camera |
| "subway" / "metro" | handheld iphone selfie, woman talking to camera at underground metro station, shaky camera movement |
| "office" | handheld selfie video, woman talking to camera in modern office, natural camera shake |
| "street" | handheld iphone video, woman talking to camera on city street, shaky handheld movement |
| no location | handheld iphone selfie, woman talking to camera in casual setting, natural shaky camera (default) |

**key phrases for authentic selfie look:**
- "handheld iphone selfie video" - adds realistic camera shake
- "natural shaky camera movement" - mimics real selfie recording
- "shaky handheld" - creates authentic mobile video feel

## example: full workflow

```bash
# scenario: katia sharing conference update
# script: "hey everyone! i'm so excited to share this amazing update with you from the conference today"
# photo: media/friend/katia.jpg

# step 1: generate first frame with nano banana pro
bun run lib/fal.ts image_to_image \
  "woman at busy conference hall with people walking in background, professional casual setting, natural lighting" \
  media/friend/katia.jpg \
  auto
# output: https://v3b.fal.media/files/.../first-frame.png

# step 2: generate voice
bun run lib/elevenlabs.ts tts \
  "hey everyone! i'm so excited to share this amazing update with you from the conference today" \
  rachel \
  output/voice.mp3
# output: output/voice.mp3

# step 3: upload audio
cat > /tmp/upload.ts << 'EOF'
import { fal } from "@fal-ai/client";
const file = await Bun.file("output/voice.mp3").arrayBuffer();
const url = await fal.storage.upload(new Blob([file], { type: "audio/mpeg" }));
console.log(url);
EOF
bun /tmp/upload.ts
# output: https://v3b.fal.media/files/.../audio.mpeg

# step 4: run wan 2.5
bun run lib/replicate.ts wan \
  https://v3b.fal.media/files/.../first-frame.jpg \
  https://v3b.fal.media/files/.../audio.mpeg \
  "handheld iphone selfie video, woman talking to camera in busy conference hall, natural shaky camera movement" \
  10 \
  480p
# takes 3-5 minutes...

# if timeout, check history:
bun run lib/replicate.ts list
bun run lib/replicate.ts get <prediction-id>

# step 5: download
curl -o media/friend/katia-talking.mp4 "https://replicate.delivery/.../video.mp4"
```

**tested successfully** with katia.jpg - see media/friend/ for example outputs!

## tips

- **duration constraint**: wan 2.5 only accepts 5 or 10 second videos - keep scripts short!
- **script length**: keep under 10 seconds for best results (matches wan 2.5 max duration)
- **aspect ratio preservation**: CRITICAL - always use "auto" aspect ratio in image-to-image to avoid squashed/stretched videos!
- **nano banana pro**: uses aspect_ratio="auto" to preserve original photo dimensions (portrait/landscape)
- **handheld camera**: always include "handheld iphone selfie" + "shaky camera" in wan 2.5 prompt for authentic look
- **first frame quality**: this is the base - make it look natural!
- **scene matching**: extract location from script when mentioned
- **voice selection**: rachel (default) is clear and professional
- **resolution**: 480p is faster (3-4min), 720p/1080p takes longer (5-6min)
- **save intermediates**: store outputs in media/friend/ for reuse

## voice options

```bash
# female voices (american english)
bun run lib/elevenlabs.ts tts "script" rachel output/voice.mp3
bun run lib/elevenlabs.ts tts "script" bella output/voice.mp3  
bun run lib/elevenlabs.ts tts "script" elli output/voice.mp3

# male voices (american english)
bun run lib/elevenlabs.ts tts "script" antoni output/voice.mp3
bun run lib/elevenlabs.ts tts "script" josh output/voice.mp3
```

see all voices: `bun run lib/elevenlabs.ts voices`

## environment setup

```bash
# required api keys
export ELEVENLABS_API_KEY="your_key"
export REPLICATE_API_TOKEN="your_token"
```

## changelog

**2024-11-22:**
- switched from flux to nano banana pro for image-to-image (better aspect ratio preservation)
- fixed squashed video issue by using aspect_ratio="auto"
- wan 2.5 command now available in lib/replicate.ts
- clarified duration constraints (5 or 10 seconds only)
