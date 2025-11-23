# round video character cookbook

create realistic round selfie videos for telegram: extreme close-up POV videos with authentic camera shake, lighting, and audio

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
# generate SELFIE-STYLE first frame using nano banana pro
# CRITICAL: always include "selfie photo" and "front-facing camera view" in prompt
# aspect_ratio "auto" preserves the original photo's aspect ratio (portrait/landscape)
bun run lib/fal.ts image_to_image \
  "selfie photo, woman holding phone camera facing herself at busy conference hall with people walking in background, professional casual setting, natural lighting, front-facing camera view" \
  media/friend/katia.jpg \
  auto
```

**important prompting for selfie style:**
- always start with "selfie photo"
- include "holding phone camera facing herself/himself" 
- end with "front-facing camera view"
- aspect ratio "auto" preserves original dimensions - critical for avoiding squashed/stretched video!

the output will include a URL like: `https://v3b.fal.media/files/.../image.jpg`

optionally download to save locally:
```bash
curl -o media/friend/first-frame.jpg "https://fal-output-url.jpg"
```

### step 2: generate voiceover

```bash
# generate voice from script
# save to media/friend/[name]/voice.mp3 for organization
bun run lib/elevenlabs.ts tts \
  "hey everyone! excited to share this update from the conference" \
  rachel \
  media/friend/katia/voice.mp3
```

the audio is saved to `media/friend/[name]/voice.mp3`. you'll need to upload this to get a url for wan 2.5.

### step 3: upload audio to get url

wan 2.5 needs the audio as a url. use fal storage:

```bash
# create a small script to upload
cat > /tmp/upload-audio.ts << 'EOF'
import { fal } from "@fal-ai/client";

const file = await Bun.file("media/friend/katia/voice.mp3").arrayBuffer();
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
# prompt should describe the video style and setting with maximum detail
# duration MUST be 5 or 10 seconds only (not 15, 20, etc)
bun run lib/replicate.ts wan \
  https://v3b.fal.media/files/.../first-frame.jpg \
  https://v3b.fal.media/files/.../audio.mpeg \
  "extreme close-up selfie POV video, handheld POV with continuous slight wobble and shake, subject in sharp focus with softly blurred background shallow depth of field, blurred background, dark indoor busy setting with abstract out-of-focus lights, conversational audio with muffled background crowd chatter and commotion indicating public location" \
  10 \
  480p
```

**detailed prompt structure for realistic selfie videos:**

the prompt should include ALL these elements for maximum authenticity:

**camera technique:**
- "extreme close-up selfie POV video"
- "handheld POV directly in front of face"
- "continuous slight wobble and shake"

**focus & composition:**
- "subject in sharp focus"
- "softly blurred background shallow depth of field"

**lighting:**
- "dramatic low-light scene"
- "intense magenta hot pink light illuminating face" (or specify your lighting color)
- "blue ambient lights in blurred background" (optional, for busy settings)

**setting:**
- "dark indoor busy setting with abstract out-of-focus lights" (adjust based on location)

**audio characteristics:**
- "conversational audio with muffled background crowd chatter and commotion indicating public location"

this comprehensive prompting creates videos that look like authentic, quickly-recorded selfie messages with realistic imperfections

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
- voiceover: `media/friend/[name]/voice.mp3`
- final video: `media/friend/[name]/talking-character.mp4`

## timing

- first frame generation: 5-10s
- voiceover: 5-10s
- wan 2.5 processing: 3-5min

**total: ~5 minutes**

## scene context examples

choose setting based on script context. always include handheld camera description for authentic look:

| script mentions | step 1: first frame prompt | wan 2.5 prompt (detailed style) |
|----------------|---------------------------|--------------------------------|
| "at the conference" / "hackathon" | selfie photo, woman holding phone facing herself at busy conference hall with people walking in background, front-facing camera view | extreme close-up selfie POV video, handheld phone directly in front of face with continuous slight wobble, subject in sharp focus with softly blurred background, dramatic low-light with intense magenta hot pink light illuminating face and blue ambient lights in blurred background, dark indoor busy conference setting with abstract out-of-focus lights, conversational audio with muffled background crowd chatter |
| "subway" / "metro" | selfie photo, woman holding phone facing herself at underground metro station with commuters, front-facing camera view | extreme close-up selfie POV video, handheld phone with slight shake, sharp focus on subject with blurred metro background, harsh fluorescent lighting with cool tones, dark underground station with out-of-focus commuters and lights, audio with echoing background noise and distant train sounds |
| "office" | selfie photo, woman holding phone facing herself in modern office workspace, front-facing camera view | extreme close-up selfie POV video, handheld phone wobble, sharp subject focus with blurred office background, soft indoor office lighting, modern workspace with blurred monitors and colleagues in background, conversational audio with quiet office ambient noise |
| "street" | selfie photo, woman holding phone facing herself on city street with pedestrians, front-facing camera view | extreme close-up selfie POV video, handheld shake, sharp focus with blurred street background, natural daylight or street lighting, urban setting with out-of-focus pedestrians and traffic, audio with street noise and distant traffic sounds |
| no location | selfie photo, woman holding phone facing herself in casual setting, front-facing camera view | extreme close-up selfie POV video, handheld phone with slight wobble, sharp subject with softly blurred background, natural indoor lighting, casual indoor setting, conversational audio (default) |

**key phrases for authentic selfie look:**

**step 1 (first frame):**
- "selfie photo" - establishes selfie perspective
- "holding phone camera facing herself/himself" - person is taking the selfie
- "front-facing camera view" - reinforces selfie angle

**step 4 (wan 2.5) - comprehensive style elements:**

*camera technique:*
- "extreme close-up selfie POV video"
- "handheld phone directly in front of face"
- "continuous slight wobble and shake"

*focus & depth:*
- "subject in sharp focus"
- "softly blurred background"
- "shallow depth of field"

*lighting:*
- "dramatic low-light scene"
- "intense magenta hot pink light illuminating face" (adjust color per setting)
- "blue ambient lights in blurred background" (optional)

*setting:*
- "dark indoor busy setting"
- "abstract out-of-focus lights"
- adjust per location (conference/metro/office/street)

*audio:*
- "conversational audio with muffled background crowd chatter and commotion"
- adjust per setting (metro=echoing/train sounds, office=quiet ambient, street=traffic)

## example: full workflow

```bash
# scenario: katia sharing conference update
# script: "hey everyone! i'm so excited to share this amazing update with you from the conference today"
# photo: media/friend/katia.jpg

# step 1: generate SELFIE first frame with nano banana pro
bun run lib/fal.ts image_to_image \
  "selfie photo, woman holding phone camera facing herself at busy conference hall with people walking in background, professional casual setting, natural lighting, front-facing camera view" \
  media/friend/katia.jpg \
  auto
# output: https://v3b.fal.media/files/.../first-frame.png

# step 2: generate voice
bun run lib/elevenlabs.ts tts \
  "hey everyone! i'm so excited to share this amazing update with you from the conference today" \
  rachel \
  media/friend/katia/voice.mp3
# output: media/friend/katia/voice.mp3

# step 3: upload audio
cat > /tmp/upload.ts << 'EOF'
import { fal } from "@fal-ai/client";
const file = await Bun.file("media/friend/katia/voice.mp3").arrayBuffer();
const url = await fal.storage.upload(new Blob([file], { type: "audio/mpeg" }));
console.log(url);
EOF
bun /tmp/upload.ts
# output: https://v3b.fal.media/files/.../audio.mpeg

# step 4: run wan 2.5 with detailed style prompt
bun run lib/replicate.ts wan \
  https://v3b.fal.media/files/.../first-frame.jpg \
  https://v3b.fal.media/files/.../audio.mpeg \
  "extreme close-up selfie POV video, handheld phone directly in front of face with continuous slight wobble and shake, subject in sharp focus with softly blurred background shallow depth of field, dramatic low-light scene with intense magenta hot pink light illuminating face and blue ambient lights in blurred background, dark indoor busy conference setting with abstract out-of-focus lights, conversational audio with muffled background crowd chatter and commotion" \
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

- **selfie perspective**: CRITICAL - always include "selfie photo, holding phone facing herself/himself, front-facing camera view" in step 1!
- **duration constraint**: wan 2.5 only accepts 5 or 10 second videos - keep scripts short!
- **script length**: keep under 10 seconds for best results (matches wan 2.5 max duration)
- **aspect ratio preservation**: CRITICAL - always use "auto" aspect ratio in image-to-image to avoid squashed/stretched videos!
- **nano banana pro**: uses aspect_ratio="auto" to preserve original photo dimensions (portrait/landscape)
- **handheld camera**: always include "handheld iphone selfie" + "shaky camera" in wan 2.5 prompt for authentic look
- **first frame quality**: this is the base - make it look natural and selfie-like!
- **scene matching**: extract location from script when mentioned
- **voice selection**: rachel (default) is clear and professional
- **resolution**: 480p is faster (3-4min), 720p/1080p takes longer (5-6min)
- **save intermediates**: store outputs in media/friend/[name]/ for organization and reuse

## voice options

```bash
# female voices (american english)
bun run lib/elevenlabs.ts tts "script" rachel media/friend/[name]/voice.mp3
bun run lib/elevenlabs.ts tts "script" bella media/friend/[name]/voice.mp3  
bun run lib/elevenlabs.ts tts "script" elli media/friend/[name]/voice.mp3

# male voices (american english)
bun run lib/elevenlabs.ts tts "script" antoni media/friend/[name]/voice.mp3
bun run lib/elevenlabs.ts tts "script" josh media/friend/[name]/voice.mp3
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
