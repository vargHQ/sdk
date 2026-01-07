# varg CLI Reference

AI video infrastructure from your terminal.

## Installation

```bash
bun install -g @vargai/sdk
```

## Commands Overview

| Command | Description |
|---------|-------------|
| `varg run <action>` | Run a model or action |
| `varg list` | List all available actions |
| `varg find <query>` | Fuzzy search for actions |
| `varg which <name>` | Inspect action schema |
| `varg upload <file>` | Upload file to cloud storage |

## Global Options

All `run` commands support:
- `--info` — show action help
- `--schema` — show action schema as JSON
- `--json` — output result as JSON
- `--quiet` — minimal output

---

## Generation Actions

### image

Generate image from text.

```bash
# Basic image generation
varg run image --prompt "cyberpunk cityscape at night"

# Specify aspect ratio
varg run image --prompt "portrait of a robot" --size square
```

**Options:** `--prompt` (required), `--size` (default: landscape_4_3)

---

### video

Generate video from text or image.

```bash
# Text to video
varg run video --prompt "camera flies through clouds"

# Image to video (animate an image)
varg run video --prompt "gentle wind movement" --image ./photo.jpg

# Longer duration
varg run video --prompt "ocean waves" --duration 10
```

**Options:** `--prompt` (required), `--image`, `--duration` (5 or 10, default: 5)

---

### voice

Text to speech generation.

```bash
# Basic TTS
varg run voice --text "Hello, welcome to the future"

# Choose voice
varg run voice --text "Breaking news today" --voice sam

# Save to specific file
varg run voice --text "Custom output" --output ./narration.mp3
```

**Options:** `--text` (required), `--voice` (default: rachel), `--output`

---

### transcribe

Speech to text transcription.

```bash
# Transcribe audio file
varg run transcribe --audio ./speech.mp3

# Transcribe video file
varg run transcribe --audio ./interview.mp4

# Choose provider
varg run transcribe --audio ./audio.wav --provider deepgram
```

**Options:** `--audio` (required), `--provider` (default: groq), `--output`

---

## Video Editing Actions

### trim

Extract a segment from video (keep only start-end).

```bash
# Keep seconds 10-30
varg run trim --video ./input.mp4 --start 10 --end 30

# Save to specific path
varg run trim --video ./input.mp4 --start 0 --end 5 --output ./intro.mp4
```

**Options:** `--video` (required), `--start` (required), `--end` (required), `--output`

---

### remove

Delete a segment from the middle of a video.

```bash
# Remove seconds 5-10
varg run remove --video ./input.mp4 --from 5 --to 10

# Remove unwanted section
varg run remove --video ./interview.mp4 --from 120 --to 145 --output ./clean.mp4
```

**Options:** `--video` (required), `--from` (required), `--to` (required), `--output`

---

### split

Divide video into N equal-length parts.

```bash
# Split into 3 equal parts
varg run split --video ./long-video.mp4 --parts 3

# Custom output prefix
varg run split --video ./movie.mp4 --parts 5 --output-prefix chapter
```

**Options:** `--video` (required), `--parts` (required), `--output-prefix`

---

### cut

Split video at specific timestamps into separate clips.

```bash
# Cut at specific points
varg run cut --video ./podcast.mp4 --timestamps 60,120,180

# Creates clips: 0-60s, 60-120s, 120-180s, 180s-end
varg run cut --video ./interview.mp4 --timestamps 300,600 --output-prefix segment
```

**Options:** `--video` (required), `--timestamps` (required, comma-separated), `--output-prefix`

---

### merge

Join multiple videos into one.

```bash
# Simple merge
varg run merge --videos ./clip1.mp4,./clip2.mp4 --output ./combined.mp4

# With crossfade transition
varg run merge --videos ./a.mp4,./b.mp4,./c.mp4 --output ./final.mp4 --transition crossfade

# Handle different resolutions
varg run merge --videos ./vertical.mp4,./horizontal.mp4 --output ./merged.mp4 --fit pad
```

**Options:** `--videos` (required, comma-separated), `--output` (required), `--transition` (default: cut), `--duration` (default: 1), `--fit` (pad/crop/stretch)

---

### transition

Join two videos with a transition effect.

```bash
# Crossfade between clips
varg run transition --video1 ./intro.mp4 --video2 ./main.mp4 --type crossfade --output ./result.mp4

# Fade to black transition
varg run transition --video1 ./scene1.mp4 --video2 ./scene2.mp4 --type fade --duration 2 --output ./movie.mp4
```

**Options:** `--video1` (required), `--video2` (required), `--type` (required), `--duration` (default: 1), `--fit`, `--output` (required)

---

### fade

Add fade in, fade out, or both.

```bash
# Fade in at start
varg run fade --video ./clip.mp4 --type in

# Fade out at end
varg run fade --video ./clip.mp4 --type out --duration 2

# Both fade in and out
varg run fade --video ./clip.mp4 --type both --output ./faded.mp4
```

**Options:** `--video` (required), `--type` (required: in/out/both), `--duration` (default: 1), `--output`

---

### edit

General video editing (trim + resize).

```bash
# Trim video
varg run edit --input ./raw.mp4 --output ./trimmed.mp4 --start 5 --duration 30

# Resize to vertical (9:16)
varg run edit --input ./landscape.mp4 --output ./vertical.mp4 --preset vertical

# Resize to square
varg run edit --input ./video.mp4 --output ./square.mp4 --preset square
```

**Options:** `--input` (required), `--output` (required), `--start`, `--duration`, `--preset` (vertical/square/landscape/4k)

---

### captions

Add subtitles to video.

```bash
# Auto-generate basic subtitles
varg run captions --video ./interview.mp4 --output ./subtitled.mp4

# TikTok-style animated captions
varg run captions --video ./clip.mp4 --output ./viral.mp4 --mode tiktok

# Use existing SRT file
varg run captions --video ./movie.mp4 --output ./final.mp4 --srt ./subtitles.srt
```

**Options:** `--video` (required), `--output` (required), `--mode` (basic/tiktok), `--srt`, `--provider` (default: groq), `--position`, `--bounce`, `--noBounce`

---

### sync

Sync audio to video (lipsync).

```bash
# Basic lipsync
varg run sync --video ./talking-head.mp4 --audio ./voiceover.mp3

# Specify method and output
varg run sync --video ./avatar.mp4 --audio ./speech.wav --method latentsync --output ./synced.mp4
```

**Options:** `--video` (required), `--audio` (required), `--method` (default: latentsync), `--output`

---

## Utility Commands

### upload

Upload local file to cloud storage.

```bash
# Upload with auto-generated path
varg upload ./video.mp4

# Upload to specific destination
varg upload ./render.mp4 --destination projects/campaign/final.mp4

# Upload to folder
varg upload ./image.png --destination users/123/
```

**Options:** `--destination`, `--json`, `--quiet`

---

### list

Discover available actions.

```bash
# List all actions
varg list

# Filter by type
varg list video
```

---

### find

Fuzzy search for actions.

```bash
# Search by keyword
varg find audio
varg find text
varg find edit
```

---

### which

Inspect action schema and options.

```bash
# View action details
varg which video
varg which captions
```
