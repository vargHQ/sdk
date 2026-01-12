# ffmpeg video mixing lessons

## problem: audio/video desync when mixing clips

### what went wrong

using `-ss X -t Y` to pre-trim input, then applying relative trim filters caused timing drift:

```bash
# BAD: relative timestamps after pre-trim
ffmpeg -ss 64 -t 36 -i original.mp4 ...
  -filter_complex "
    [0:v]split=5[orig1][orig2]...;
    [orig1]trim=0:4,setpts=PTS-STARTPTS[o1];
    [orig2]trim=4:11,setpts=PTS-STARTPTS[o2];
    ..."
```

this produced wrong duration (38s instead of 36s) with audio desync.

### solution: use absolute timestamps from full input

trim directly from full original using absolute timestamps:

```bash
# GOOD: absolute timestamps from full file
ffmpeg -i original.mp4 -i scene1.mp4 -i scene2.mp4 ...
  -filter_complex "
    [0:v]trim=64:68,setpts=PTS-STARTPTS[o1];
    [1:v]scale=1280:720,trim=4:6,setpts=PTS-STARTPTS[s1];
    [0:v]trim=70:75,setpts=PTS-STARTPTS[o2];
    ...
    [o1][s1][o2]...concat=n=N:v=1:a=0[outv];
    [0:a]atrim=64:100,asetpts=PTS-STARTPTS[outa]
  "
  -map "[outv]" -map "[outa]"
```

### key points

1. **absolute timestamps**: trim from full input file, not pre-trimmed
2. **separate audio handling**: use `atrim` on audio stream independently
3. **setpts reset**: always use `setpts=PTS-STARTPTS` after trim to reset timestamps
4. **scale before trim**: when mixing different resolutions, scale first then trim
5. **video duration = audio duration**: ensure total video segments match audio segment length

### example: inserting clips into original

to insert generated clips at specific timestamps while keeping continuous audio:

```bash
ffmpeg -y \
  -i original.mp4 \
  -i generated-scene.mp4 \
  -filter_complex "
    [0:v]trim=START1:END1,setpts=PTS-STARTPTS[o1];
    [1:v]scale=1280:720,trim=0:DURATION,setpts=PTS-STARTPTS[s1];
    [0:v]trim=START2:END2,setpts=PTS-STARTPTS[o2];
    [o1][s1][o2]concat=n=3:v=1:a=0[outv];
    [0:a]atrim=AUDIO_START:AUDIO_END,asetpts=PTS-STARTPTS[outa]
  " \
  -map "[outv]" -map "[outa]" \
  -c:v libx264 -preset fast -crf 18 \
  -c:a aac -b:a 192k \
  output.mp4
```

timestamps must add up: `(END1-START1) + DURATION + (END2-START2) = AUDIO_END - AUDIO_START`
