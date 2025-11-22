# remotion skill

## overview
programmatic video creation with react components using remotion

## what you can use remotion for

### 1. video editing
- trim videos to specific frame ranges
- adjust playback speed (slow motion, time-lapse)
- apply filters and color grading with CSS
- overlay graphics and text
- create picture-in-picture effects

### 2. zooming and panning
- smooth zoom in/out effects with `interpolate()`
- ken burns effect on static images
- dynamic camera movements
- focus on specific areas frame-by-frame

### 3. combining multiple videos
- concatenate videos sequentially (one after another)
- play videos side-by-side or in grid layouts
- layer videos with opacity/blend modes
- transition between scenes with crossfades

### 4. audio mixing
- combine multiple audio tracks
- sync audio with video
- adjust volume levels with `interpolate()`
- add background music and sound effects
- fade in/out audio

### 5. beautiful subtitles
- word-by-word animated captions
- styled text with custom fonts and colors
- background boxes for readability
- position captions anywhere on screen
- karaoke-style highlighting
- emoji support and rich formatting

### 6. thumbnail generation
- extract first frame as preview image
- render specific frames as stills
- create animated thumbnails
- generate multiple preview frames

### 7. advanced effects
- motion graphics and animations
- data visualizations synchronized with narration
- dynamic text reveals
- progress bars and timers
- responsive layouts that adapt to content

## capabilities

### project creation
- create new remotion project from template
- clone git repository and install dependencies
- returns project directory for editing

### composition editing
- edit react components to create video scenes
- use remotion's `<Video>`, `<Audio>`, `<Img>` components
- add animations with `useCurrentFrame()` and `interpolate()`
- parse and display subtitles/captions
- combine multiple videos sequentially or in parallel

### rendering
- bundle project with webpack
- render compositions to mp4 video
- render single frames as images (thumbnails)
- track rendering progress

## common patterns

### 1. create video with captions
```typescript
import { createProject, render } from "lib/remotion";

// create project
const project = await createProject();

// edit composition (add to src/MyComp.tsx)
// - add Video component with staticFile("video.mp4")
// - parse SRT file and display captions
// - use useCurrentFrame() to sync captions with video

// render
await render({
  entryPoint: project.entryPoint,
  compositionId: "MyComp",
  outputPath: "output.mp4"
});
```

### 2. concatenate videos
```typescript
// in composition:
const frame = useCurrentFrame();
const video1Duration = 1430; // frames

{frame < video1Duration ? (
  <Video src={staticFile("video1.mp4")} />
) : (
  <Video 
    src={staticFile("video2.mp4")}
    startFrom={frame - video1Duration}
  />
)}
```

### 3. add styled captions
```typescript
interface Subtitle {
  startTime: number;
  endTime: number;
  text: string;
}

const currentTime = frame / fps;
const subtitle = subtitles.find(
  s => currentTime >= s.startTime && currentTime <= s.endTime
);

{subtitle && (
  <div style={{
    fontSize: 48,
    fontWeight: "bold",
    color: "white",
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: "20px 40px",
    borderRadius: 12
  }}>
    {subtitle.text}
  </div>
)}
```

## important notes

### media file paths
- copy media to `public/` directory in project
- use `staticFile("filename.mp4")` to reference
- absolute paths won't work in remotion

### frame-based timing
- everything in remotion is frame-based
- calculate duration: `frames = seconds * fps`
- get current time: `currentTime = frame / fps`

### video concatenation
- calculate end frame of first video
- start second video at that frame
- adjust `startFrom` prop for proper timing

### composition registration
- register compositions in `src/Root.tsx`
- specify id, width, height, fps, durationInFrames
- use unique composition ids

## typical workflow

1. **probe videos** (get duration, fps, resolution)
   ```bash
   bun run lib/ffmpeg.ts probe video.mp4
   ```

2. **create project**
   ```bash
   bun run lib/remotion.ts create
   ```

3. **copy media files**
   ```bash
   cp video.mp4 /path/to/project/public/
   ```

4. **create composition** (src/MyComp.tsx)
   - import remotion components
   - use `useCurrentFrame()` and `useVideoConfig()`
   - add videos, images, text
   - implement captions/animations

5. **register composition** (src/Root.tsx)
   ```tsx
   <Composition
     id="MyVideo"
     component={MyComp}
     durationInFrames={1500}
     fps={30}
     width={1920}
     height={1080}
   />
   ```

6. **render**
   ```bash
   bun run lib/remotion.ts render /path/to/project/src/index.ts MyVideo output.mp4
   ```

## tools available

### lib/remotion.ts
```bash
# create project from template
bun run lib/remotion.ts create [template-url]

# list compositions
bun run lib/remotion.ts compositions <entry-point.ts>

# render video
bun run lib/remotion.ts render <entry-point.ts> <comp-id> <output.mp4>

# render still frame
bun run lib/remotion.ts still <entry-point.ts> <comp-id> <frame> <out.png>
```

### lib/ffmpeg.ts
```bash
# get video metadata
bun run lib/ffmpeg.ts probe <input.mp4>
```

## examples

### extract first frame as thumbnail
```bash
# render frame 0 as image
bun run lib/remotion.ts still /path/to/project/src/index.ts MyVideo 0 thumbnail.png
```

```typescript
// or render first frame in composition
import { staticFile } from "remotion";

// this will capture the first frame
<Img src={staticFile("video.mp4")} />
```

### zoom in effect
```typescript
import { interpolate } from "remotion";

const frame = useCurrentFrame();

// zoom from 1x to 2x over 60 frames
const scale = interpolate(frame, [0, 60], [1, 2], {
  extrapolateRight: "clamp"
});

return (
  <AbsoluteFill>
    <div style={{
      transform: `scale(${scale})`,
      transformOrigin: "center center"
    }}>
      <Video src={staticFile("video.mp4")} />
    </div>
  </AbsoluteFill>
);
```

### ken burns effect (pan + zoom)
```typescript
const scale = interpolate(frame, [0, 150], [1, 1.3]);
const translateX = interpolate(frame, [0, 150], [0, -100]);
const translateY = interpolate(frame, [0, 150], [0, -50]);

return (
  <div style={{
    transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)`,
  }}>
    <Img src={staticFile("image.jpg")} />
  </div>
);
```

### combine multiple audio tracks
```typescript
import { Audio } from "remotion";

return (
  <AbsoluteFill>
    <Video src={staticFile("video.mp4")} />
    {/* background music at 30% volume */}
    <Audio src={staticFile("music.mp3")} volume={0.3} />
    {/* voiceover at full volume */}
    <Audio src={staticFile("narration.mp3")} volume={1} />
  </AbsoluteFill>
);
```

### audio fade in/out
```typescript
const audioVolume = interpolate(
  frame,
  [0, 30, 270, 300],  // fade in first 30 frames, out last 30
  [0, 1, 1, 0],
  { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
);

<Audio src={staticFile("music.mp3")} volume={audioVolume} />
```

### side-by-side videos
```typescript
const { width, height } = useVideoConfig();

return (
  <AbsoluteFill>
    {/* left video */}
    <AbsoluteFill style={{ width: width / 2, left: 0 }}>
      <Video src={staticFile("video1.mp4")} />
    </AbsoluteFill>
    
    {/* right video */}
    <AbsoluteFill style={{ width: width / 2, left: width / 2 }}>
      <Video src={staticFile("video2.mp4")} />
    </AbsoluteFill>
  </AbsoluteFill>
);
```

### grid layout (4 videos)
```typescript
return (
  <AbsoluteFill style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
    <Video src={staticFile("video1.mp4")} />
    <Video src={staticFile("video2.mp4")} />
    <Video src={staticFile("video3.mp4")} />
    <Video src={staticFile("video4.mp4")} />
  </AbsoluteFill>
);
```

### video with word-by-word captions
```typescript
// parse SRT
const subtitles = parseSRT(srtContent);

// in component
const frame = useCurrentFrame();
const { fps } = useVideoConfig();
const currentTime = frame / fps;

const currentSubtitle = subtitles.find(
  sub => currentTime >= sub.startTime && currentTime <= sub.endTime
);

return (
  <AbsoluteFill>
    <Video src={staticFile("video.mp4")} />
    {currentSubtitle && (
      <div className="caption">{currentSubtitle.text}</div>
    )}
  </AbsoluteFill>
);
```

### sequential video concatenation
```typescript
const fitnessEnd = 1430; // 47.67s * 30fps
const kangarooStart = fitnessEnd;
const kangarooEnd = kangarooStart + 152; // 5.04s * 30fps

return (
  <AbsoluteFill>
    {frame < fitnessEnd ? (
      <Video src={staticFile("fitness.mp4")} />
    ) : (
      <OffthreadVideo 
        src={staticFile("kangaroo.mp4")}
        startFrom={Math.floor((frame - kangarooStart) * (24/30))}
      />
    )}
  </AbsoluteFill>
);
```

### crossfade transition between videos
```typescript
const transitionStart = 140;
const transitionDuration = 20;

const opacity1 = interpolate(
  frame,
  [transitionStart, transitionStart + transitionDuration],
  [1, 0],
  { extrapolateRight: "clamp" }
);

const opacity2 = interpolate(
  frame,
  [transitionStart, transitionStart + transitionDuration],
  [0, 1],
  { extrapolateRight: "clamp" }
);

return (
  <AbsoluteFill>
    <AbsoluteFill style={{ opacity: opacity1 }}>
      <Video src={staticFile("video1.mp4")} />
    </AbsoluteFill>
    <AbsoluteFill style={{ opacity: opacity2 }}>
      <Video src={staticFile("video2.mp4")} />
    </AbsoluteFill>
  </AbsoluteFill>
);
```

### beautiful animated captions
```typescript
// word appears from bottom with bounce
const captionY = interpolate(
  frame - subtitle.startFrame,
  [0, 10],
  [50, 0],
  { extrapolateRight: "clamp", easing: Easing.bounce }
);

const captionOpacity = interpolate(
  frame - subtitle.startFrame,
  [0, 5],
  [0, 1],
  { extrapolateRight: "clamp" }
);

{currentSubtitle && (
  <div style={{
    fontFamily: "Inter",
    fontSize: 60,
    fontWeight: "900",
    color: "#FFD700",
    textAlign: "center",
    textShadow: "4px 4px 8px rgba(0,0,0,0.8)",
    background: "linear-gradient(135deg, rgba(0,0,0,0.9), rgba(20,20,50,0.9))",
    padding: "30px 50px",
    borderRadius: 20,
    border: "3px solid #FFD700",
    transform: `translateY(${captionY}px)`,
    opacity: captionOpacity,
  }}>
    {currentSubtitle.text.toUpperCase()}
  </div>
)}
```

## troubleshooting

### video not loading (404 error)
- ensure video is in `public/` directory
- use `staticFile("filename.mp4")` not absolute paths
- check file exists: `ls project/public/filename.mp4`

### composition not found
- verify composition is registered in `src/Root.tsx`
- check composition id matches exactly
- run `compositions` command to list available

### wrong video duration
- probe video to get exact duration and fps
- calculate frames: `durationInFrames = duration * fps`
- account for fps differences when concatenating

### captions not syncing
- verify SRT timestamps are in seconds
- convert to frame-based timing: `frame / fps`
- check start/end time comparisons

## best practices

1. **always probe videos first** - get accurate duration/fps
2. **copy media to public/** - use staticFile() helper
3. **calculate frames correctly** - duration * fps
4. **test compositions** - use compositions command before rendering
5. **handle fps differences** - adjust startFrom when concatenating
6. **use descriptive ids** - make composition names clear
7. **cleanup temp dirs** - call cleanup() when done (optional)
