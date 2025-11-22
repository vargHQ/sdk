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
# sync lips with voiceover (future: service/sync.ts)
# combines video + audio for perfect lipsync
```

### 5. add captions
```bash
# add tiktok-style captions (future: service/captions.ts)
# overlay text on video with timing
```

## expected output
- character headshot (png)
- voiceover audio (mp3)
- animated video (mp4)
- final video with lipsync + captions (mp4)

## estimated time
- headshot: 30s
- voiceover: 10s
- animation: 2-3min
- lipsync: 30s
- captions: 10s

total: ~4min
