# Video Generation Templates

Complete code templates for common video generation patterns.

## Table of Contents

1. [Simple Slideshow](#simple-slideshow)
2. [Animated Video with Music](#animated-video-with-music)
3. [Talking Character](#talking-character)
4. [TikTok Multi-Clip](#tiktok-multi-clip)
5. [Character with Consistent Style](#character-with-consistent-style)
6. [Split Screen Comparison](#split-screen-comparison)

---

## Simple Slideshow

**Requirements:** FAL_API_KEY only

Basic image slideshow with transitions and zoom effects.

```tsx
// slideshow.tsx
import { render, Render, Clip, Image } from "vargai/react";

const SCENES = [
  "sunset over ocean, cinematic golden hour",
  "mountain peaks at dawn, misty atmosphere", 
  "city skyline at night, neon lights",
  "forest path in autumn, fallen leaves",
];

async function main() {
  await render(
    <Render width={1080} height={1920}>
      {SCENES.map((prompt, i) => (
        <Clip 
          key={i} 
          duration={3} 
          transition={{ name: "fade", duration: 0.5 }}
        >
          <Image prompt={prompt} zoom="in" />
        </Clip>
      ))}
    </Render>,
    { output: "output/slideshow.mp4" }
  );
  
  console.log("Done! output/slideshow.mp4");
}

main();
```

Run: `bun run slideshow.tsx`

---

## Animated Video with Music

**Requirements:** FAL_API_KEY + ELEVENLABS_API_KEY

Video with AI-generated animation and background music.

```tsx
// animated-video.tsx
import { render, Render, Clip, Image, Animate, Music } from "vargai/react";
import { fal, elevenlabs } from "vargai/ai";

async function main() {
  await render(
    <Render width={1080} height={1920}>
      <Music
        prompt="upbeat electronic pop, energetic, modern tiktok vibe"
        model={elevenlabs.musicModel()}
        duration={10}
        volume={0.7}
      />

      <Clip duration={5}>
        <Animate
          image={Image({ 
            prompt: "cute cat sitting on windowsill, golden hour lighting",
            model: fal.imageModel("flux-schnell")
          })}
          motion="cat slowly turns head, blinks, tail swishes gently"
          model={fal.videoModel("wan-2.5")}
          duration={5}
        />
      </Clip>

      <Clip duration={5} transition={{ name: "fade", duration: 0.5 }}>
        <Animate
          image={Image({ 
            prompt: "same cat stretching on windowsill, yawning"
          })}
          motion="cat stretches, yawns widely, settles back down"
          model={fal.videoModel("wan-2.5")}
          duration={5}
        />
      </Clip>
    </Render>,
    { output: "output/cat-video.mp4" }
  );
}

main();
```

---

## Talking Character

**Requirements:** FAL_API_KEY + ELEVENLABS_API_KEY

Character that speaks with animated movement.

```tsx
// talking-character.tsx
import { render, Render, Clip, Image, Animate, Speech } from "vargai/react";
import { fal, elevenlabs } from "vargai/ai";

const CHARACTER = "friendly cartoon robot, blue metallic body, expressive LED eyes, studio background";

const SCRIPT = `
Hello! I'm your AI assistant.
Today I'm going to show you something amazing.
Let's create some videos together!
`;

async function main() {
  await render(
    <Render width={1080} height={1920}>
      <Clip duration="auto">
        <Animate
          image={Image({ 
            prompt: CHARACTER, 
            aspectRatio: "9:16",
            model: fal.imageModel("flux-schnell")
          })}
          motion="robot talking naturally, subtle head movements, eyes blink occasionally, friendly gestures"
          model={fal.videoModel("wan-2.5")}
        />
        <Speech 
          voice="adam" 
          model={elevenlabs.speechModel("turbo")}
        >
          {SCRIPT}
        </Speech>
      </Clip>
    </Render>,
    { output: "output/talking-robot.mp4" }
  );
}

main();
```

**Available voices:** `adam`, `rachel`, `bella`, `sam`, `josh`

---

## TikTok Multi-Clip

**Requirements:** FAL_API_KEY + ELEVENLABS_API_KEY

Multi-scene TikTok-style video with varied camera angles.

```tsx
// tiktok-video.tsx
import { render, Render, Clip, Image, Animate, Music, Title } from "vargai/react";
import { fal, elevenlabs } from "vargai/ai";

const CHARACTER = "confident young woman, casual style, bright smile, modern apartment";

const SCENES = [
  { 
    prompt: "extreme close-up face, surprised expression, wide eyes",
    motion: "eyes widen in surprise, eyebrows raise, subtle gasp"
  },
  { 
    prompt: "medium shot, laughing genuinely, hand on chest",
    motion: "head tilts back slightly, genuine laugh, shoulders shake"
  },
  { 
    prompt: "close-up, knowing smirk, raised eyebrow",
    motion: "slow smile forms, eyebrow raises, subtle head nod"
  },
  { 
    prompt: "medium shot, waving at camera, bright smile",
    motion: "waves energetically at camera, bright smile, slight bounce"
  },
];

async function main() {
  await render(
    <Render width={1080} height={1920}>
      <Music
        prompt="trendy tiktok music, upbeat, catchy hook, viral sound"
        model={elevenlabs.musicModel()}
        duration={8}
        volume={0.6}
      />

      {SCENES.map((scene, i) => (
        <Clip 
          key={i} 
          duration={2} 
          transition={{ name: "fade", duration: 0.3 }}
        >
          <Animate
            image={Image({ 
              prompt: `${CHARACTER}, ${scene.prompt}`,
              aspectRatio: "9:16",
              model: fal.imageModel("flux-schnell")
            })}
            motion={scene.motion}
            model={fal.videoModel("wan-2.5")}
            duration={5}
          />
          {i === 0 && (
            <Title position="bottom">POV: When it actually works</Title>
          )}
        </Clip>
      ))}
    </Render>,
    { output: "output/tiktok-video.mp4" }
  );
}

main();
```

---

## Character with Consistent Style

**Requirements:** FAL_API_KEY

Reuse the same character reference for visual consistency across clips.

```tsx
// consistent-character.tsx
import { render, Render, Clip, Image, Animate } from "vargai/react";
import { fal } from "vargai/ai";

async function main() {
  // Define character once - same reference = same generated image
  const character = Image({ 
    prompt: "cute cartoon fox, orange fur, big eyes, friendly expression",
    model: fal.imageModel("flux-schnell"),
    aspectRatio: "9:16"
  });

  await render(
    <Render width={1080} height={1920}>
      <Clip duration={3}>
        <Animate
          image={character}
          motion="fox waves hello, tail wagging"
          model={fal.videoModel("wan-2.5")}
          duration={3}
        />
      </Clip>
      
      <Clip duration={3} transition={{ name: "fade", duration: 0.5 }}>
        <Animate
          image={character}
          motion="fox dances happily, spinning around"
          model={fal.videoModel("wan-2.5")}
          duration={3}
        />
      </Clip>
      
      <Clip duration={3} transition={{ name: "fade", duration: 0.5 }}>
        <Animate
          image={character}
          motion="fox blows a kiss at camera, winks"
          model={fal.videoModel("wan-2.5")}
          duration={3}
        />
      </Clip>
    </Render>,
    { output: "output/fox-video.mp4" }
  );
}

main();
```

---

## Split Screen Comparison

**Requirements:** FAL_API_KEY

Side-by-side comparison layout.

```tsx
// split-screen.tsx
import { render, Render, Clip, Image, Animate, Split, Title } from "vargai/react";
import { fal } from "vargai/ai";

async function main() {
  const before = Image({ 
    prompt: "messy room, clothes everywhere, unmade bed",
    aspectRatio: "3:4"
  });
  
  const after = Image({ 
    prompt: "clean organized room, made bed, tidy shelves",
    aspectRatio: "3:4"
  });

  await render(
    <Render width={1080} height={1920}>
      <Clip duration={5}>
        <Split direction="horizontal">
          <Animate 
            image={before} 
            motion="camera slowly pans across messy room"
            model={fal.videoModel("wan-2.5")}
          />
          <Animate 
            image={after} 
            motion="camera slowly pans across clean room"
            model={fal.videoModel("wan-2.5")}
          />
        </Split>
        <Title position="bottom">
          BEFORE          AFTER
        </Title>
      </Clip>
    </Render>,
    { output: "output/split-comparison.mp4" }
  );
}

main();
```

---

## Component Reference

| Component | Props | Description |
|-----------|-------|-------------|
| `<Render>` | `width`, `height`, `fps` | Root container |
| `<Clip>` | `duration`, `transition` | Sequential segment |
| `<Image>` | `prompt`, `src`, `model`, `aspectRatio`, `zoom` | AI or static image |
| `<Animate>` | `image`, `motion`, `model`, `duration` | Image-to-video |
| `<Video>` | `src`, `prompt`, `model`, `keepAudio` | Video file or generated |
| `<Music>` | `prompt`, `model`, `duration`, `volume`, `loop` | Background music |
| `<Speech>` | `voice`, `model`, `children` | Text-to-speech |
| `<Title>` | `position`, `color`, `start`, `end` | Text overlay |
| `<Split>` | `direction` | Side-by-side layout |

## Transitions

Available transition effects:

- `fade` - Simple fade
- `crossfade` - Cross dissolve
- `wipeleft`, `wiperight`, `wipeup`, `wipedown` - Directional wipes
- `slideleft`, `slideright`, `slideup`, `slidedown` - Slides
- `cube` - 3D cube rotation
- `pixelize` - Pixelation effect

```tsx
<Clip transition={{ name: "cube", duration: 0.8 }}>
```

## Aspect Ratios

| Ratio | Use Case | Dimensions |
|-------|----------|------------|
| `9:16` | TikTok, Reels, Shorts | 1080x1920 |
| `16:9` | YouTube, Twitter | 1920x1080 |
| `1:1` | Instagram posts | 1080x1080 |
| `4:5` | Instagram portrait | 1080x1350 |
