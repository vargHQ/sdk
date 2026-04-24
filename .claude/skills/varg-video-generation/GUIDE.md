## vargai - AI Video Generation

### Setup

```bash
bunx vargai init
bun install vargai ai
```

Required: `FAL_KEY` in `.env`
Optional: `ELEVENLABS_API_KEY` (voice/music), `REPLICATE_API_TOKEN` (lipsync), `GROQ_API_KEY` (transcription)

### Render videos

```bash
bunx vargai render video.tsx
```

### Basic structure

Every file needs the JSX pragma and exports a default `<Render>`:

```tsx
/** @jsxImportSource vargai */
import { Render, Clip, Image, Video, Speech, Captions, Music } from "vargai/react";
import { fal, elevenlabs } from "vargai/ai";

export default (
  <Render width={1080} height={1920}>
    <Clip duration={5}>
      <Image prompt="..." model={fal.imageModel("flux-pro")} aspectRatio="9:16" />
    </Clip>
  </Render>
);
```

### Quirks and gotchas

1. **Reusable character pattern** - Export character as named export so it can be imported by other files, then use `<Image src={character} />` in the Clip:
   ```tsx
   /** @jsxImportSource vargai */
   import { Captions, Clip, Image, Render, Speech } from "vargai/react";
   import { elevenlabs, fal } from "vargai/ai";

   export const character = Image({
     prompt: "character description",
     model: fal.imageModel("nano-banana-pro"),
     aspectRatio: "9:16",
   });

   export default (
     <Render width={1080} height={1920}>
       <Clip duration={21}>
         <Image src={character} />
       </Clip>
       <Captions src={voiceover} style="tiktok" color="#ffffff" activeColor="#FFD700" withAudio />
     </Render>
   );
   ```
   This file can be both rendered directly (`bunx vargai render file.tsx`) and imported by other files (`import { character } from "./file.tsx"`).

2. **Captions and audio** - `<Captions src={voiceover} />` renders captions only (no audio). Add `withAudio` to also play the speech audio: `<Captions src={voiceover} withAudio />`.

3. **Clip duration** - Omit `duration` to auto-fit content. Set explicit `duration={N}` to lock length. If duration is shorter than content, you get black screen while audio continues.

4. **Model names must be exact**:
   - Images: `flux-pro`, `nano-banana-pro`, `nano-banana-pro/edit`
   - Videos: `kling-v2.5`, `wan-2.5`
   - Lipsync: `sync-v2-pro` (NOT `sync-lipsync`)
   - Speech: `eleven_multilingual_v2`

5. **Speech function syntax**:
   ```tsx
   // Correct - use for voiceover/captions source
   const voiceover = Speech({
     model: elevenlabs.speechModel("eleven_multilingual_v2"),
     voice: "21m00Tcm4TlvDq8ikWAM",
     children: "Text to speak",
   });

   // Inside Clip - use JSX with children
   <Speech voice="21m00Tcm4TlvDq8ikWAM" model={elevenlabs.speechModel("eleven_multilingual_v2")}>
     Text to speak
   </Speech>
   ```

6. **Image-to-image editing** - Use `nano-banana-pro/edit` with prompt object:
   ```tsx
   const edited = Image({
     prompt: {
       text: "new description",
       images: [baseImage],
     },
     model: fal.imageModel("nano-banana-pro/edit"),
   });
   ```

7. **Lipsync videos** - Pass video and audio to sync:
   ```tsx
   <Video
     prompt={{
       video: generatedVideo,
       audio: voiceover,
     }}
     model={fal.videoModel("sync-v2-pro")}
   />
   ```

8. **Caching** - Same prompts/params hit cache automatically. Regenerate by changing prompts.

### Simple template (still image + voiceover + captions)

```tsx
/** @jsxImportSource vargai */
import { Captions, Clip, Image, Render, Speech } from "vargai/react";
import { elevenlabs, fal } from "vargai/ai";

const SCRIPT = \`Your script here.\`;

const voiceover = Speech({
  model: elevenlabs.speechModel("eleven_multilingual_v2"),
  voice: "21m00Tcm4TlvDq8ikWAM",
  children: SCRIPT,
});

export default (
  <Render width={1080} height={1920}>
    <Clip duration={21}>
      <Image
        prompt="character description"
        model={fal.imageModel("nano-banana-pro")}
        aspectRatio="9:16"
      />
    </Clip>
    <Captions src={voiceover} style="tiktok" color="#ffffff" activeColor="#FFD700" withAudio />
  </Render>
);
```

### Aspect ratios

- `9:16` - TikTok, Reels, Shorts (vertical)
- `16:9` - YouTube (horizontal)
- `1:1` - Instagram (square)

### Workflow

1. **Commit every change** - After each successful render or code change, commit to preserve progress.
2. **Test incrementally** - Start simple (still image + audio), add complexity (video, lipsync) step by step.
3. **Check duration** - Use `ffprobe -v error -show_entries format=duration -of csv=p=0 output/file.mp4` to verify video length.
4. **Open to preview** - Use `open output/file.mp4` to view rendered videos.
