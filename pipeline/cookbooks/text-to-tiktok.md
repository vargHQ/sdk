# reddit post to minecraft tiktok pipeline

turn a reddit post into a tiktok with minecraft parkour background and alan watts style voiceover

## prerequisites

- minecraft parkour video in `media/backgrounds/minecraft_parkour.mp4`
- reddit post text in `media/<project>/post.md`
- elevenlabs api key (for alan watts style voice)

## steps

### 1. prepare your content

create a folder for your project:
```bash
mkdir -p media/girl-ruined-you
```

put your post text in `media/girl-ruined-you/post.md`

### 2. download minecraft parkour background (if needed)

```bash
# download a minecraft parkour video from youtube
yt-dlp "https://www.youtube.com/watch?v=n_Dv4JMiwK8" -o "media/backgrounds/minecraft_parkour.mp4"
```

or use any 10+ minute minecraft parkour gameplay video

### 3. generate voiceover with elevenlabs

```bash
# alan watts style - deep, contemplative, philosophical
bun run lib/elevenlabs.ts tts "media/girl-ruined-you/post.md" --voice "Antoni" --model "eleven_multilingual_v2"
```

voice options for philosophical vibe:
- `Antoni` - deep, mature male
- `Adam` - deep american male  
- `Bill` - deep american narrator

output: `output/voiceover.mp3`

### 4. get word-level timestamps with whisper

```bash
# transcribe with word timestamps
bun run action/transcribe/index.ts output/voiceover.mp3 --timestamps word
```

output: `output/voiceover_segments.json`

### 5. generate ASS subtitles

```bash
# create word-by-word animated subtitles
bun run action/captions/index.ts output/voiceover_segments.json --style tiktok --output output/subtitles.ass
```

### 6. combine video with ffmpeg

```bash
# combine minecraft background + voiceover + subtitles
bun run lib/ffmpeg.ts combine \
  --background media/backgrounds/minecraft_parkour.mp4 \
  --audio output/voiceover.mp3 \
  --subtitles output/subtitles.ass \
  --output output/final_tiktok.mp4 \
  --size 1080x1920 \
  --loop-background
```

## manual ffmpeg command (alternative)

```bash
ffmpeg -stream_loop -1 -i media/backgrounds/minecraft_parkour.mp4 \
  -i output/voiceover.mp3 \
  -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,ass=output/subtitles.ass" \
  -c:v libx264 -preset faster -crf 23 \
  -c:a aac -b:a 128k \
  -shortest \
  -movflags +faststart \
  output/final_tiktok.mp4
```

## expected output

- voiceover audio (mp3) - ~2-3 min for 400 word post
- word timestamps (json)
- ASS subtitles with word-by-word animation
- final tiktok video (mp4) - 1080x1920 vertical

## estimated time

- voiceover generation: 30s
- whisper transcription: 30s
- subtitle generation: 5s
- video combination: 1-2min

total: ~3min

## tips

### voice style for philosophical content
- speed: 0.9-1.0x (slower = more gravitas)
- stability: 0.5-0.7 (some variation)
- similarity boost: 0.75

### subtitle styling
- font: Arial Bold or Impact
- size: 48-64px
- position: bottom third (80% from top)
- outline: 3px black
- one word at a time for tiktok engagement

### background video
- use random offset to avoid repetitive starts
- loop if audio is longer than background
- slight zoom/pan can add dynamism
