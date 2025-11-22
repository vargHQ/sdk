# remotion video creation pipeline

## overview
create programmatic videos using react components with remotion

## when to use
- need precise control over video composition
- want to add dynamic captions/subtitles
- combining multiple videos with effects
- creating videos from templates
- need frame-perfect synchronization

## prerequisites
```bash
bun install remotion @remotion/cli
```

## pipeline steps

### step 1: analyze source media
probe all input videos to get metadata

```bash
bun run lib/ffmpeg.ts probe media/video1.mp4
bun run lib/ffmpeg.ts probe media/video2.mp4
```

**capture:**
- duration (seconds)
- fps (frames per second)
- resolution (width x height)
- codec

**calculate:**
- total frames = duration * fps
- end frame for concatenation

### step 2: create remotion project
```bash
bun run lib/remotion.ts create
```

**output:**
- projectDir: temp directory path
- entryPoint: src/index.ts path
- cleanup: function to remove temp dir

**save projectDir** for editing files

### step 3: prepare media files
copy all media to project's public directory

```bash
cp media/video1.mp4 {projectDir}/public/
cp media/video2.mp4 {projectDir}/public/
cp media/audio.mp3 {projectDir}/public/
```

if using subtitles, read and parse SRT files:
```typescript
const srtContent = await Bun.file("media/subtitles.srt").text();
```

### step 4: create composition component
create new file in `{projectDir}/src/MyComposition.tsx`

**basic structure:**
```typescript
import { AbsoluteFill, Video, useCurrentFrame, useVideoConfig, staticFile } from "remotion";

export const MyComposition: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  return (
    <AbsoluteFill>
      <Video src={staticFile("video1.mp4")} />
    </AbsoluteFill>
  );
};
```

**for captions:**
```typescript
// parse SRT at top of file
const subtitles = parseSRT(`1
00:00:00,231 --> 00:00:00,491
Hello

2
00:00:00,491 --> 00:00:00,651
World
`);

// in component
const currentTime = frame / fps;
const currentSubtitle = subtitles.find(
  sub => currentTime >= sub.startTime && currentTime <= sub.endTime
);

{currentSubtitle && (
  <div style={{
    fontFamily: "Inter",
    fontSize: 48,
    fontWeight: "bold",
    color: "white",
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: "20px 40px",
    borderRadius: 12,
  }}>
    {currentSubtitle.text}
  </div>
)}
```

**for concatenation:**
```typescript
const video1EndFrame = 1430; // calculated from probe
const video2StartFrame = video1EndFrame;

{frame < video1EndFrame ? (
  <Video src={staticFile("video1.mp4")} />
) : (
  <OffthreadVideo 
    src={staticFile("video2.mp4")}
    startFrom={Math.floor((frame - video2StartFrame) * (24/30))}
  />
)}
```

### step 5: register composition
edit `{projectDir}/src/Root.tsx`

```typescript
import { MyComposition } from "./MyComposition";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MyVideo"
        component={MyComposition}
        durationInFrames={1582}  // total frames
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
```

**calculate durationInFrames:**
- single video: `duration * fps`
- concatenated: `video1Frames + video2Frames`
- use fps from probe results

### step 6: verify compositions
```bash
bun run lib/remotion.ts compositions {projectDir}/src/index.ts
```

**check output:**
- composition id matches
- dimensions are correct
- fps is correct
- durationInFrames is correct

### step 7: render video
```bash
bun run lib/remotion.ts render {projectDir}/src/index.ts MyVideo output.mp4
```

**rendering process:**
1. bundles project with webpack
2. launches chrome headless
3. renders each frame
4. encodes with ffmpeg (h264 codec)
5. saves to output.mp4

**monitor:**
- progress percentage
- frames rendered
- frames encoded

### step 8: verify output
```bash
bun run lib/ffmpeg.ts probe output.mp4
```

check:
- duration matches expected
- fps is correct
- resolution is correct

### step 9: cleanup (optional)
```typescript
// if you saved the cleanup function from step 2
project.cleanup();
```

## common workflows

### workflow 1: video + captions
```
1. probe video → get duration, fps
2. create project
3. copy video to public/
4. create composition with Video + captions
5. parse SRT file into subtitle array
6. sync captions with useCurrentFrame()
7. register composition
8. render
```

### workflow 2: concatenate videos
```
1. probe all videos → get durations, fps
2. calculate frame boundaries
3. create project
4. copy all videos to public/
5. create composition with frame-based switching
6. handle fps conversions if needed
7. register composition with total duration
8. render
```

### workflow 3: video with overlay graphics
```
1. probe video
2. create project
3. copy video + images to public/
4. create composition with layers
5. use interpolate() for animations
6. position overlays with AbsoluteFill
7. register composition
8. render
```

## calculation formulas

### frames to seconds
```typescript
const seconds = frames / fps;
```

### seconds to frames
```typescript
const frames = Math.floor(seconds * fps);
```

### fps conversion
```typescript
// video is 24fps, composition is 30fps
const adjustedFrame = Math.floor(frame * (24 / 30));
```

### srt time to seconds
```typescript
function parseTime(time: string) {
  const [hours, minutes, rest] = time.split(":");
  const [seconds, ms] = rest.split(",");
  return (
    parseInt(hours) * 3600 +
    parseInt(minutes) * 60 +
    parseInt(seconds) +
    parseInt(ms) / 1000
  );
}
```

## tips & tricks

### caption styling
```typescript
// word-by-word bold captions
{
  fontFamily: "Inter",
  fontSize: 48,
  fontWeight: "bold",
  color: "white",
  textAlign: "center",
  backgroundColor: "rgba(0, 0, 0, 0.7)",
  padding: "20px 40px",
  borderRadius: 12,
  textTransform: "uppercase",
  letterSpacing: 2,
}
```

### smooth transitions
```typescript
import { interpolate } from "remotion";

const opacity = interpolate(
  frame,
  [0, 30, 60],
  [0, 1, 0],
  { extrapolateRight: "clamp" }
);
```

### loading fonts
```typescript
import { loadFont } from "@remotion/google-fonts/Inter";
const { fontFamily } = loadFont();
```

### responsive layouts
```typescript
const { width, height } = useVideoConfig();
const scale = Math.min(width / 1920, height / 1080);
```

## troubleshooting

### issue: video not loading
**solution:**
- verify file is in `public/` directory
- use `staticFile("filename.mp4")` not absolute path
- check file permissions

### issue: captions out of sync
**solution:**
- verify SRT timestamps
- check fps matches video fps
- log currentTime to debug: `console.log(frame / fps)`

### issue: wrong video duration
**solution:**
- probe video to get exact duration
- calculate frames correctly: `duration * fps`
- round to nearest frame

### issue: concatenation glitch
**solution:**
- calculate exact end frame of first video
- adjust `startFrom` for fps differences
- use `Math.floor()` for frame calculations

### issue: render fails
**solution:**
- check all media files exist in public/
- verify composition is registered
- ensure durationInFrames is sufficient
- check console for webpack errors

## performance optimization

### use OffthreadVideo
for better performance when concatenating:
```typescript
<OffthreadVideo src={staticFile("video.mp4")} />
```

### limit font requests
```typescript
loadFont({
  weights: ["400", "700"], // only needed weights
  subsets: ["latin"],      // only needed subsets
});
```

### optimize media files
```bash
# compress video before using
bun run lib/ffmpeg.ts convert input.mp4 output.mp4
```

## example: complete workflow

```bash
# 1. probe videos
bun run lib/ffmpeg.ts probe media/fitness-demo.mp4
# output: 360x640 @ 30fps, 47.67s

bun run lib/ffmpeg.ts probe media/kangaroo-scene.mp4
# output: 1920x1080 @ 24fps, 5.04s

# 2. create project
bun run lib/remotion.ts create
# directory: /tmp/remotion-xyz
# entryPoint: /tmp/remotion-xyz/src/index.ts

# 3. copy media
cp media/fitness-demo.mp4 /tmp/remotion-xyz/public/
cp media/kangaroo-scene.mp4 /tmp/remotion-xyz/public/

# 4-5. create and register composition
# (edit src/DemoComposition.tsx and src/Root.tsx)

# 6. verify
bun run lib/remotion.ts compositions /tmp/remotion-xyz/src/index.ts
# Demo: 360x640 @ 30fps (1582 frames)

# 7. render
bun run lib/remotion.ts render /tmp/remotion-xyz/src/index.ts Demo media/output.mp4
# [remotion] progress: 100.0% | rendered: 1582 | encoded: 1582
# [remotion] saved to media/output.mp4

# 8. verify output
bun run lib/ffmpeg.ts probe media/output.mp4
# 360x640 @ 30fps, 52.73s
```

## see also
- lib/remotion/SKILL.md - detailed remotion skill reference
- lib/ffmpeg.ts - video probing and editing
- service/captions/ - automated caption generation
- service/edit/ - video editing workflows
