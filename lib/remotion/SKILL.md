# remotion skill

## overview
programmatic video creation with react components using remotion

## quick start
```bash
# 1. create composition with template files
bun run lib/remotion/index.ts create MyVideo
# creates: lib/remotion/compositions/MyVideo.tsx (composition component)
#          lib/remotion/compositions/MyVideo.root.tsx (root with registerRoot)

# 2. copy media files to public directory
mkdir -p lib/remotion/public
cp media/video.mp4 media/audio.mp3 lib/remotion/public/

# 3. customize the generated composition files
# - edit MyVideo.tsx to add your video/image/audio content
# - edit MyVideo.root.tsx to set fps, duration, width, height

# 4. render
bun run lib/remotion/index.ts render lib/remotion/compositions/MyVideo.root.tsx MyVideo output.mp4
```

**important**: always use `staticFile("filename.ext")` for media paths, never absolute paths

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
- render specific frames as stills (using remotion's renderStill)
- create custom thumbnail compositions with text/graphics
- generate multiple preview frames at different timestamps
- design animated thumbnail previews

### 7. advanced effects
- motion graphics and animations
- data visualizations synchronized with narration
- dynamic text reveals
- progress bars and timers
- responsive layouts that adapt to content

## capabilities

### composition creation
- create composition structure with `bun run lib/remotion/index.ts create <name>`
- automatically generates template files:
  - `<name>.tsx` - composition component with all necessary imports
  - `<name>.root.tsx` - root file with registerRoot() already configured
- files are ready to customize with your content
- media files go in `lib/remotion/public/`

### composition editing
- write react components to create video scenes
- use remotion's `<OffthreadVideo>`, `<Audio>`, `<Img>` components
- reference media with `staticFile("filename.mp4")` helper
- add animations with `useCurrentFrame()` and `interpolate()`
- parse and display subtitles/captions
- combine multiple videos sequentially or in parallel

### root file setup
- must use `registerRoot()` function (not export)
- register compositions with `<Composition>` component
- specify id, component, durationInFrames, fps, width, height

### rendering
- bundle project with webpack automatically
- render compositions to mp4 video with h264 codec
- render single frames as images (thumbnails)
- track rendering progress in real-time

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

### audio/voiceover duration
- always probe audio files before setting composition duration
- voiceovers are often much longer than you think (can be 30s, 60s, or more)
- never assume voiceover duration - always check with ffmpeg probe
- common mistake: setting durationInFrames too short, cutting off audio
- workflow: 
  1. probe voiceover: `bun run lib/ffmpeg.ts probe media/voiceover.mp3`
  2. note the duration (e.g., 45.2 seconds)
  3. calculate frames: `45.2 * 30fps = 1356 frames`
  4. set composition `durationInFrames` to match or exceed this
- if video is shorter than audio, you need to either:
  - extend video with images/broll to match audio length
  - trim the audio to match video length
- verify before rendering: check that composition duration >= audio duration

### image dimensions and aspect ratios
- be mindful of image aspect ratios vs composition dimensions
- images may not fill the frame properly (leaving black bars or getting cropped)
- common solutions:
  - `objectFit: "cover"` - fills frame but crops image
  - `objectFit: "contain"` - fits full image but may leave black bars
  - **blurred background technique** - best of both worlds:
    1. layer 1 (background): same image scaled to fill, with blur filter
    2. layer 2 (foreground): full image fitted with `objectFit: "contain"`
    3. result: no black bars, full image visible, aesthetic blurred background
- always check how images look in final composition, especially portrait images in landscape frames

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

1. **probe all media files** (especially audio/voiceover - they're often very long)
   ```bash
   # probe video to get duration, fps, resolution
   bun run lib/ffmpeg.ts probe media/video.mp4
   
   # probe voiceover/audio to get true duration
   bun run lib/ffmpeg.ts probe media/voiceover.mp3
   # voiceovers can be 30s, 60s, or more - never assume
   ```

2. **create composition with templates**
   ```bash
   bun run lib/remotion/index.ts create MyVideo
   ```
   this automatically creates:
   - `lib/remotion/compositions/MyVideo.tsx` (composition component)
   - `lib/remotion/compositions/MyVideo.root.tsx` (root file with registerRoot)

3. **copy media to public directory**
   ```bash
   mkdir -p lib/remotion/public
   cp media/video.mp4 media/audio.mp3 media/*.png lib/remotion/public/
   ```

4. **customize composition** (lib/remotion/compositions/MyVideo.tsx)
   - template already has all imports: `OffthreadVideo`, `Audio`, `Img`, `staticFile`
   - replace placeholder content with your media
   - use `staticFile("filename.mp4")` for all media references
   - add animations with `useCurrentFrame()` and `interpolate()`
   
   ```tsx
   // example customization
   const video = staticFile("video.mp4");
   const audio = staticFile("audio.mp3");
   
   return (
     <AbsoluteFill>
       <OffthreadVideo src={video} />
       <Audio src={audio} />
     </AbsoluteFill>
   );
   ```

5. **configure settings** (lib/remotion/compositions/MyVideo.root.tsx)
   - template already uses `registerRoot()` correctly
   - update fps, durationInFrames, width, height as needed
   ```tsx
   const fps = 30;
   const durationInFrames = 150; // 5 seconds
   const width = 1920;
   const height = 1080;
   ```

6. **render**
   ```bash
   bun run lib/remotion/index.ts render lib/remotion/compositions/MyVideo.root.tsx MyVideo output.mp4
   ```

## tools available

### lib/remotion/index.ts
```bash
# setup composition directory
bun run lib/remotion/index.ts create <name>

# list compositions
bun run lib/remotion/index.ts compositions <root-file.tsx>

# render video
bun run lib/remotion/index.ts render <root-file.tsx> <comp-id> <output.mp4>

# render still frame
bun run lib/remotion/index.ts still <root-file.tsx> <comp-id> <frame> <out.png>
```

### lib/ffmpeg.ts
```bash
# get video metadata
bun run lib/ffmpeg.ts probe <input.mp4>
```

## examples

### complete workflow: video + images montage with audio

```bash
# 1. probe video to get metadata
bun run lib/ffmpeg.ts probe media/video.mp4
# output: 1920x1080 @ 24fps, 5.041667s

# 2. create composition structure
bun run lib/remotion/index.ts create MediaMontage
# creates: lib/remotion/compositions/MediaMontage.tsx
#          lib/remotion/compositions/MediaMontage.root.tsx

# 3. copy specific media files to public directory
mkdir -p lib/remotion/public
cp media/video.mp4 media/audio.ogg media/image1.png media/image2.png media/image3.png media/image4.png lib/remotion/public/

# 4. create composition file (MediaMontage.tsx)
cat > lib/remotion/compositions/MediaMontage.tsx << 'EOF'
import React from "react";
import { AbsoluteFill, OffthreadVideo, Audio, Img, useCurrentFrame, useVideoConfig, interpolate, staticFile } from "remotion";

export const MediaMontage: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const imageDisplayTime = 3;
  const imageFrames = imageDisplayTime * fps;
  const videoFrames = Math.floor(5.041667 * fps);
  
  const videoPath = staticFile("video.mp4");
  const audioPath = staticFile("audio.ogg");
  const images = [
    staticFile("image1.png"),
    staticFile("image2.png"),
  ];

  const videoEnd = videoFrames;
  let content: React.ReactNode = null;
  
  if (frame < videoEnd) {
    content = <OffthreadVideo src={videoPath} />;
  } else {
    const imageFrame = frame - videoEnd;
    const imageIndex = Math.floor(imageFrame / imageFrames);
    
    if (imageIndex < images.length) {
      const localFrame = imageFrame % imageFrames;
      const scale = interpolate(localFrame, [0, imageFrames], [1, 1.15], { extrapolateRight: "clamp" });
      content = (
        <div style={{ width: "100%", height: "100%", transform: `scale(${scale})` }}>
          <Img src={images[imageIndex] as string} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      );
    }
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {content}
      <Audio src={audioPath} />
    </AbsoluteFill>
  );
};
EOF

# 5. create root file (MediaMontage.root.tsx)
cat > lib/remotion/compositions/MediaMontage.root.tsx << 'EOF'
import React from "react";
import { Composition, registerRoot } from "remotion";
import { MediaMontage } from "./MediaMontage";

const fps = 30;
const videoFrames = Math.floor(5.041667 * fps);
const imageFrames = 4 * 3 * fps; // 4 images, 3 seconds each
const totalFrames = videoFrames + imageFrames;

registerRoot(() => {
  return (
    <>
      <Composition
        id="MediaMontage"
        component={MediaMontage}
        durationInFrames={totalFrames}
        fps={fps}
        width={1920}
        height={1080}
      />
    </>
  );
});
EOF

# 6. render composition
bun run lib/remotion/index.ts render lib/remotion/compositions/MediaMontage.root.tsx MediaMontage media/output.mp4

# 7. verify output
bun run lib/ffmpeg.ts probe media/output.mp4
# output: 1920x1080 @ 30fps, 17.033s
```

### render specific frame as thumbnail
```bash
# render frame 100 as image (useful for video preview)
bun run lib/remotion.ts still /path/to/project/src/index.ts MyVideo 100 thumbnail.png
```

```typescript
// create custom thumbnail composition with graphics
export const Thumbnail: React.FC = () => {
  return (
    <AbsoluteFill>
      <Video src={staticFile("video.mp4")} />
      {/* add title overlay */}
      <div style={{
        position: "absolute",
        bottom: 50,
        fontSize: 60,
        fontWeight: "bold",
        color: "white",
      }}>
        My Video Title
      </div>
    </AbsoluteFill>
  );
};

// then render frame 0 of this composition
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

### image with blurred background (aspect ratio fix)
```typescript
// fits any image into frame without black bars
// works great for portrait images in landscape compositions
const imageSrc = staticFile("portrait-image.jpg");

return (
  <AbsoluteFill>
    {/* blurred background layer - fills entire frame */}
    <AbsoluteFill>
      <Img 
        src={imageSrc} 
        style={{ 
          width: "100%", 
          height: "100%", 
          objectFit: "cover",
          filter: "blur(40px)",
          opacity: 0.6
        }} 
      />
    </AbsoluteFill>
    
    {/* foreground layer - full image fitted */}
    <AbsoluteFill style={{ 
      display: "flex", 
      justifyContent: "center", 
      alignItems: "center" 
    }}>
      <Img 
        src={imageSrc} 
        style={{ 
          maxWidth: "100%", 
          maxHeight: "100%", 
          objectFit: "contain"
        }} 
      />
    </AbsoluteFill>
  </AbsoluteFill>
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
    <OffthreadVideo src={staticFile("video.mp4")} />
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

return (
  <AbsoluteFill>
    {frame < fitnessEnd ? (
      <OffthreadVideo src={staticFile("fitness.mp4")} />
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

### "registerRoot" error when rendering
- **error**: `This file does not contain "registerRoot"`
- **cause**: root file exports component instead of calling registerRoot()
- **fix**: use `registerRoot(() => { return (<>...</>) })` instead of `export const RemotionRoot`
- **example**:
  ```tsx
  // ❌ wrong
  export const RemotionRoot: React.FC = () => { return (<>...</>) };
  
  // ✅ correct
  import { registerRoot } from "remotion";
  registerRoot(() => { return (<>...</>) });
  ```

### video not loading (404 error)
- **error**: `Received a status code of 404 while downloading file`
- **cause**: using absolute file paths instead of staticFile()
- **fix**: copy media to `lib/remotion/public/` and use `staticFile()`
- **example**:
  ```tsx
  // ❌ wrong
  const video = "/Users/aleks/project/media/video.mp4";
  
  // ✅ correct - copy file first
  // cp media/video.mp4 lib/remotion/public/
  import { staticFile } from "remotion";
  const video = staticFile("video.mp4");
  ```

### deprecated components warnings
- **warning**: `Video` and `Audio` are deprecated
- **fix**: use `OffthreadVideo` instead of `Video`, `Audio` is still usable but may change
- **example**:
  ```tsx
  // ❌ deprecated
  import { Video } from "remotion";
  <Video src={staticFile("video.mp4")} />
  
  // ✅ recommended
  import { OffthreadVideo } from "remotion";
  <OffthreadVideo src={staticFile("video.mp4")} />
  ```

### type errors with array indexing
- **error**: `Type 'string | undefined' is not assignable to type 'string'`
- **cause**: typescript doesn't know array index is valid
- **fix**: use type assertion `as string` or check bounds
- **example**:
  ```tsx
  // ❌ type error
  <Img src={images[index]} />
  
  // ✅ with type assertion
  <Img src={images[index] as string} />
  
  // ✅ with bounds check
  {index < images.length && <Img src={images[index]} />}
  ```

### composition not found
- verify composition is registered with registerRoot()
- check composition id matches exactly
- run `compositions` command to list available

### audio/voiceover gets cut off
- error: rendered video ends before audio finishes
- cause: composition `durationInFrames` is shorter than audio duration
- fix: probe audio first, calculate correct frame count
- example:
  ```bash
  # probe the voiceover
  bun run lib/ffmpeg.ts probe media/voiceover.mp3
  # output: duration: 47.2s
  
  # calculate frames for 30fps
  # 47.2 * 30 = 1416 frames
  
  # in root file, set durationInFrames to at least 1416
  const durationInFrames = 1416; // or higher if adding more content
  ```
- prevention: always probe audio files before setting composition duration
- common mistake: assuming voiceover is only 5-10 seconds when it's actually 30-60+ seconds

### wrong video duration
- probe video to get exact duration and fps
- calculate frames: `durationInFrames = duration * fps`
- account for fps differences when concatenating

### captions not syncing
- verify SRT timestamps are in seconds
- convert to frame-based timing: `frame / fps`
- check start/end time comparisons

## best practices

1. **always probe videos first** - get accurate duration/fps using `bun run lib/ffmpeg.ts probe`
2. **probe audio files too** - voiceovers/narration are often 30s, 60s, or longer - never guess duration
3. **verify composition duration vs audio** - make sure `durationInFrames` is >= audio duration, or audio will be cut off
4. **copy media to public/** - copy all media files to `lib/remotion/public/` before rendering
5. **use staticFile() for all media** - never use absolute paths in compositions
6. **use registerRoot()** - root files must call `registerRoot()`, not export a component
7. **use OffthreadVideo** - prefer `OffthreadVideo` over deprecated `Video` component
8. **calculate frames correctly** - `durationInFrames = duration * fps`
9. **test compositions** - run `compositions` command to verify before rendering
10. **handle fps differences** - adjust startFrom when concatenating videos with different fps
11. **use descriptive ids** - make composition names clear and unique
