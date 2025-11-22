# talking character pipeline

create a talking character video with lipsync and captions

## steps

### 1. create character headshot
```bash
# generate character using higgsfield soul
bun run service/image.ts soul "professional headshot of a friendly person, studio lighting" true
```

### 2. generate voiceover
```bash
# use fal voice synthesis
bun run lib/fal.ts generate_speech "hello world, this is my voice" true
```

### 3. animate character
```bash
# image-to-video with character talking
bun run service/video.ts from_image "person talking naturally, professional demeanor" <headshot_url> 5 true
```

### 4. add lipsync
```bash
# sync lips with voiceover
bun run service/sync.ts overlay <video_url> <audio_url> output.mp4
```

### 5. add captions
```bash
# add auto-generated captions with transcription
bun run service/captions.ts output.mp4 captioned.mp4 --provider fireworks
```

### 6. prepare for social media
```bash
# resize and optimize for tiktok/instagram
bun run service/edit.ts social captioned.mp4 final-tiktok.mp4 tiktok
```

## expected output
- character headshot (png)
- voiceover audio (mp3)
- animated video (mp4)
- lipsynced video (mp4)
- captioned video (mp4)
- final social media ready video (mp4)

## estimated time
- headshot: 30s
- voiceover: 10s
- animation: 2-3min
- lipsync: 30s
- captions: 15s (includes transcription)
- social prep: 5s

total: ~4-5min
