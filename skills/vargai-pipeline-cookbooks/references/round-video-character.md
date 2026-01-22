# round video character cookbook

create realistic round selfie videos for telegram: front-facing camera POV videos with authentic camera shake, lighting, and audio

## what this does

1. generates 3 first frame options: person in specified setting (conference, station, etc)
2. ai picks the best first frame from the 3 options
3. generates voiceover from text script
4. creates talking video using wan 2.5 with audio sync

## inputs

- `text_script`: what the person will say
- `profile_photo`: photo of the person (e.g., media/friend/katia.jpg)
- `scene_location`: where they are (from script or default: conference/underground station)

## steps

### step 1: generate first frame options (person in setting)

generate 3 variations and let ai pick the best one:

```bash
# generate 3 SELFIE-STYLE first frame options using nano banana pro
# CRITICAL: use the proven prompt structure below
# aspect_ratio "auto" preserves the original photo's aspect ratio (portrait/landscape)

# option 1
bun run lib/fal.ts image_to_image \
  "selfie POV, camera with subtle natural wobble and shake throughout, focus on subject with shallow depth of field, dramatic low-light environment with intense magenta and hot pink lighting creating strong color cast, ambient blue lights scattered in background, dark indoor busy setting, abstract out-of-focus colorful lights creating busy background, location: hackathon space, wear black hoodie without any text on it" \
  media/friend/katia.jpg \
  auto

# option 2
bun run lib/fal.ts image_to_image \
  "selfie POV, camera with subtle natural wobble and shake throughout, focus on subject with shallow depth of field, dramatic low-light environment with intense magenta and hot pink lighting creating strong color cast, ambient blue lights scattered in background, dark indoor busy setting, abstract out-of-focus colorful lights creating busy background, location: hackathon space, wear black hoodie without any text on it" \
  media/friend/katia.jpg \
  auto

# option 3
bun run lib/fal.ts image_to_image \
  "selfie POV, camera with subtle natural wobble and shake throughout, focus on subject with shallow depth of field, dramatic low-light environment with intense magenta and hot pink lighting creating strong color cast, ambient blue lights scattered in background, dark indoor busy setting, abstract out-of-focus colorful lights creating busy background, location: hackathon space, wear black hoodie without any text on it" \
  media/friend/katia.jpg \
  auto
```

**important prompting for selfie style (image-to-image):**
- start with "selfie POV" - simple and effective
- include "camera with subtle natural wobble and shake throughout"
- specify "focus on subject with shallow depth of field"
- lighting: "dramatic low-light environment with intense magenta and hot pink lighting creating strong color cast"
- background: "ambient blue lights scattered in background, dark indoor busy setting, abstract out-of-focus colorful lights"
- clothing: "wear black hoodie without any text on it" (or specify other clothing)
- location: flexible - adjust based on script (hackathon space, metro station, office, etc.)
- aspect ratio "auto" preserves original dimensions - critical for avoiding squashed/stretched video!

each command outputs a URL like: `https://v3b.fal.media/files/.../image.jpg`

download all 3 options:
```bash
curl -o media/friend/option1.jpg "https://url-from-option-1.jpg"
curl -o media/friend/option2.jpg "https://url-from-option-2.jpg"
curl -o media/friend/option3.jpg "https://url-from-option-3.jpg"
```

**ai should review the 3 options and pick the best one based on:**
- face quality and recognition
- natural selfie look
- lighting and color balance
- background blur and composition
- overall authenticity

use the selected image url for step 4 (wan 2.5)

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

### step 3: generate talking video with wan 2.5 (via fal)

**important: audio must be at least 3 seconds long!**

fal's wan-25 endpoint requires audio duration of 3+ seconds. if your script is too short, extend it.

```bash
# use fal's wan-25 endpoint (supports local files and urls)
# audio and image files will be auto-uploaded if local paths are provided
# duration MUST be 5 or 10 seconds only
bun run lib/fal.ts wan \
  media/friend/katia/option2.jpg \
  media/friend/katia/voice.mp3 \
  "front-facing camera selfie POV video, handheld phone directly in front of face with continuous slight wobble and shake, subject in sharp focus with softly blurred background shallow depth of field, dramatic low-light scene with intense magenta hot pink light illuminating face and blue ambient lights in blurred background, dark indoor busy conference setting with abstract out-of-focus lights, conversational audio with muffled background crowd chatter and commotion" \
  10 \
  480p
```

**command structure:**
```bash
bun run lib/fal.ts wan <image_path_or_url> <audio_path_or_url> <prompt> [duration] [resolution]
```

**parameters:**
- image: local path or url (auto-uploaded if local)
- audio: local path or url (auto-uploaded if local, **must be 3+ seconds**)
- prompt: detailed video style description
- duration: 5 or 10 (default: 5)
- resolution: 480p, 720p, or 1080p (default: 480p)

**detailed prompt structure for realistic selfie videos:**

the prompt should include ALL these elements for maximum authenticity:

**camera technique:**
- "front-facing camera selfie POV video"
- "handheld phone directly in front of face"
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
- "conversational audio with muffled background crowd chatter and commotion"

this comprehensive prompting creates videos that look like authentic, quickly-recorded selfie messages with realistic imperfections.

this takes 2-4 minutes. the command will wait for completion and output the video url.

### step 4: download result

```bash
# fal wan-25 returns video url like: https://v3b.fal.media/files/.../video.mp4
curl -o media/friend/talking-character.mp4 "https://v3b.fal.media/files/.../video.mp4"
```

## output

- first frame options: 3 variations (jpg) - `media/friend/[name]/option1.jpg`, `option2.jpg`, `option3.jpg`
- selected first frame: best option chosen by ai
- voiceover: `media/friend/[name]/voice.mp3`
- final video: `media/friend/[name]/talking-character.mp4`

## timing

- first frame generation: 15-30s (3 options)
- ai selection: instant
- voiceover: 5-10s
- wan 2.5 processing (fal): 2-4min

**total: ~3-5 minutes**

## scene context examples

choose setting based on script context. always include handheld camera description for authentic look:

| script mentions | step 1: first frame prompt | wan 2.5 prompt (detailed style) |
|----------------|---------------------------|--------------------------------|
| "at the conference" / "hackathon" | selfie POV, camera with subtle natural wobble and shake throughout, focus on subject with shallow depth of field, dramatic low-light environment with intense magenta and hot pink lighting creating strong color cast, ambient blue lights scattered in background, dark indoor busy setting, abstract out-of-focus colorful lights creating busy background, location: hackathon space, wear black hoodie without any text on it | front-facing camera selfie POV video, handheld phone directly in front of face with continuous slight wobble, subject in sharp focus with softly blurred background, dramatic low-light with intense magenta hot pink light illuminating face and blue ambient lights in blurred background, dark indoor busy conference setting with abstract out-of-focus lights, conversational audio with muffled background crowd chatter |
| "subway" / "metro" | selfie POV, camera with subtle natural wobble and shake throughout, focus on subject with shallow depth of field, dramatic low-light environment with harsh fluorescent lighting, ambient lights scattered in background, dark underground station setting, abstract out-of-focus lights, location: metro station, wear black hoodie without any text on it | front-facing camera selfie POV video, handheld phone with slight shake, sharp focus on subject with blurred metro background, harsh fluorescent lighting with cool tones, dark underground station with out-of-focus commuters and lights, audio with echoing background noise and distant train sounds |
| "office" | selfie POV, camera with subtle natural wobble and shake throughout, focus on subject with shallow depth of field, soft indoor office lighting environment, ambient lights in background, modern workspace setting, abstract out-of-focus monitors and lights, location: office, wear black hoodie without any text on it | front-facing camera selfie POV video, handheld phone wobble, sharp subject focus with blurred office background, soft indoor office lighting, modern workspace with blurred monitors and colleagues in background, conversational audio with quiet office ambient noise |
| "street" | selfie POV, camera with subtle natural wobble and shake throughout, focus on subject with shallow depth of field, natural daylight or street lighting environment, ambient lights in background, urban street setting, abstract out-of-focus pedestrians and lights, location: city street, wear black hoodie without any text on it | front-facing camera selfie POV video, handheld shake, sharp focus with blurred street background, natural daylight or street lighting, urban setting with out-of-focus pedestrians and traffic, audio with street noise and distant traffic sounds |
| no location | selfie POV, camera with subtle natural wobble and shake throughout, focus on subject with shallow depth of field, dramatic low-light environment with intense magenta and hot pink lighting creating strong color cast, ambient blue lights scattered in background, dark indoor busy setting, abstract out-of-focus colorful lights, wear black hoodie without any text on it | front-facing camera selfie POV video, handheld phone with slight wobble, sharp subject with softly blurred background, natural indoor lighting, casual indoor setting, conversational audio (default) |

**key phrases for authentic selfie look:**

**step 1 (first frame - image-to-image):**

proven prompt structure (adjust location only):
```
selfie POV, camera with subtle natural wobble and shake throughout, focus on subject with shallow depth of field, dramatic low-light environment with intense magenta and hot pink lighting creating strong color cast, ambient blue lights scattered in background, dark indoor busy setting, abstract out-of-focus colorful lights creating busy background, location: [hackathon space/metro station/office/city street], wear black hoodie without any text on it
```

- start with "selfie POV" - simple, no zoom confusion
- "camera with subtle natural wobble and shake throughout" - natural movement
- "focus on subject with shallow depth of field" - proper framing
- lighting: magenta/hot pink with blue ambient (adjust per setting)
- location: flexible - change based on script
- clothing: black hoodie without text (or adjust as needed)

**step 4 (wan 2.5) - comprehensive style elements:**

*camera technique:*
- "front-facing camera selfie POV video"
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
# note: audio must be 3+ seconds long for wan-25!

# step 1: generate 3 SELFIE first frame options with nano banana pro
bun run lib/fal.ts image_to_image \
  "selfie POV, camera with subtle natural wobble and shake throughout, focus on subject with shallow depth of field, dramatic low-light environment with intense magenta and hot pink lighting creating strong color cast, ambient blue lights scattered in background, dark indoor busy setting, abstract out-of-focus colorful lights creating busy background, location: hackathon space, wear black hoodie without any text on it" \
  media/friend/katia.jpg \
  auto
# output 1: https://v3b.fal.media/files/.../option1.png

bun run lib/fal.ts image_to_image \
  "selfie POV, camera with subtle natural wobble and shake throughout, focus on subject with shallow depth of field, dramatic low-light environment with intense magenta and hot pink lighting creating strong color cast, ambient blue lights scattered in background, dark indoor busy setting, abstract out-of-focus colorful lights creating busy background, location: hackathon space, wear black hoodie without any text on it" \
  media/friend/katia.jpg \
  auto
# output 2: https://v3b.fal.media/files/.../option2.png

bun run lib/fal.ts image_to_image \
  "selfie POV, camera with subtle natural wobble and shake throughout, focus on subject with shallow depth of field, dramatic low-light environment with intense magenta and hot pink lighting creating strong color cast, ambient blue lights scattered in background, dark indoor busy setting, abstract out-of-focus colorful lights creating busy background, location: hackathon space, wear black hoodie without any text on it" \
  media/friend/katia.jpg \
  auto
# output 3: https://v3b.fal.media/files/.../option3.png

# download all 3 options
curl -o media/friend/katia/option1.jpg "https://v3b.fal.media/files/.../option1.png"
curl -o media/friend/katia/option2.jpg "https://v3b.fal.media/files/.../option2.png"
curl -o media/friend/katia/option3.jpg "https://v3b.fal.media/files/.../option3.png"

# ai reviews the 3 options and picks the best one based on:
# - face quality and recognition
# - natural selfie look
# - lighting and color balance
# - background blur and composition
# - overall authenticity
# selected: option2 (example)

# step 2: generate voice (ensure 3+ seconds for wan-25)
bun run lib/elevenlabs.ts tts \
  "hey everyone! i'm so excited to share this amazing update with you from the conference today" \
  rachel \
  media/friend/katia/voice.mp3
# output: media/friend/katia/voice.mp3

# step 3: run wan-25 (fal) - auto-uploads local files
bun run lib/fal.ts wan \
  media/friend/katia/option2.jpg \
  media/friend/katia/voice.mp3 \
  "front-facing camera selfie POV video, handheld phone directly in front of face with continuous slight wobble and shake, subject in sharp focus with softly blurred background shallow depth of field, dramatic low-light scene with intense magenta hot pink light illuminating face and blue ambient lights in blurred background, dark indoor busy conference setting with abstract out-of-focus lights, conversational audio with muffled background crowd chatter and commotion" \
  10 \
  480p
# takes 2-4 minutes...
# output: { "data": { "video": { "url": "https://v3b.fal.media/files/.../video.mp4" } } }

# step 4: download
curl -o media/friend/katia-talking.mp4 "https://v3b.fal.media/files/.../video.mp4"
```

**tested successfully** with katia.jpg and aleks - see media/friend/ for example outputs!

## tips

- **selfie perspective**: CRITICAL - always use "selfie POV" in step 1 first frame generation!
- **audio duration**: CRITICAL - wan-25 requires audio to be at least 3 seconds long. extend short scripts!
- **duration constraint**: wan-25 only accepts 5 or 10 second videos
- **script length**: ensure script is at least 3 seconds when spoken, max 10 seconds
- **aspect ratio preservation**: CRITICAL - always use "auto" aspect ratio in image-to-image to avoid squashed/stretched videos!
- **nano banana pro**: uses aspect_ratio="auto" to preserve original photo dimensions (portrait/landscape)
- **local file support**: fal wan command auto-uploads local files - no need for manual upload step!
- **handheld camera**: always include "handheld phone" + "wobble and shake" in wan-25 prompt for authentic look
- **first frame quality**: this is the base - make it look natural and selfie-like!
- **scene matching**: extract location from script when mentioned
- **voice selection**: rachel (default) is clear and professional
- **resolution**: 480p is faster (2-3min), 720p/1080p takes longer (4-5min)
- **save intermediates**: store outputs in media/friend/[name]/ for organization and reuse
- **using fal instead of replicate**: fal's wan-25 endpoint is faster and more reliable than replicate

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
export FAL_API_KEY="your_key"  # for wan-25 and image generation (or set FAL_KEY)
```

## changelog

**2024-11-22:**
- switched to fal's wan-25-preview endpoint (faster, more reliable than replicate)
- added wan-25 support to lib/fal.ts with auto-upload for local files
- discovered: audio must be at least 3 seconds long for wan-25 (critical!)
- simplified workflow: no manual audio upload step needed
- tested successfully with aleks photo and "give me money" script
- switched from flux to nano banana pro for image-to-image (better aspect ratio preservation)
- fixed squashed video issue by using aspect_ratio="auto"
- clarified duration constraints (5 or 10 seconds only)
