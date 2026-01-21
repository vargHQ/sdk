# varg-react

declarative video rendering with ai generation. jsx for videos.

## quick start

```bash
bun install @vargai/react
```

```tsx
import { render, Render, Clip, Image, Title } from "@vargai/react";

await render(
  <Render width={1280} height={720}>
    <Clip duration={5}>
      <Image prompt="sunset over ocean, cinematic" />
      <Title position="bottom">beautiful sunset</Title>
    </Clip>
  </Render>,
  { output: "output/sunset.mp4" }
);
```

## core concepts

### everything is cached

every element computes a cache key from its props. same props = cache hit.

```tsx
// first run: generates image (~3s)
// second run: instant cache hit
<Image prompt="cyberpunk cityscape at night" />
```

change any prop and it regenerates:

```tsx
<Image prompt="cyberpunk cityscape at night" aspectRatio="9:16" />
// different aspectRatio = new cache key = regenerates
```

### clips and layers

clips are sequential. layers within a clip are stacked.

```tsx
<Render width={1080} height={1920} fps={30}>
  {/* first clip */}
  <Clip duration={5}>
    <Image prompt="coffee shop interior" />
  </Clip>
  
  {/* second clip with transition */}
  <Clip duration={3} transition={{ name: "fade", duration: 0.5 }}>
    <Image prompt="park with autumn leaves" />
  </Clip>
</Render>
```

### transitions

```tsx
<Clip transition={{ name: "fade", duration: 0.3 }}>
<Clip transition={{ name: "wipeleft", duration: 0.5 }}>
<Clip transition={{ name: "slideright", duration: 0.4 }}>
<Clip transition={{ name: "crossfade", duration: 0.5 }}>
<Clip transition={{ name: "cube", duration: 0.8 }}>
<Clip transition={{ name: "directionalwipe", duration: 0.5 }}>
```

67 gl-transitions available: `fade`, `crossfade`, `wipeleft`, `wiperight`, `wipeup`, `wipedown`, `slideleft`, `slideright`, `slideup`, `slidedown`, `cube`, `directionalwipe`, `dreamy`, `squareswire`, `radial`, `pixelize`, and more.

## rendering images

```tsx
import { Image } from "@vargai/react";

// basic
<Image prompt="ralph wiggum eating glue, simpsons style" />

// with aspect ratio
<Image prompt="fat tiger lying on couch" aspectRatio="1:1" />
<Image prompt="luigi in wheelchair racing down hill" aspectRatio="16:9" />
<Image prompt="south park cartman screaming" aspectRatio="9:16" />

// zoom animation (ken burns)
<Image prompt="epic mountain landscape" zoom="in" />
<Image prompt="white-teeth black athletic guy flexing" zoom="out" />
<Image prompt="forest path mysterious" zoom="left" />
<Image prompt="ocean waves crashing" zoom="right" />

// contain with blur (no black bars)
<Image prompt="fat tiger square photo" resize="contain-blur" />

// remove background
<Image prompt="ralph wiggum transparent" removeBackground />

// image-to-image edit
<Image 
  src="./photo.png"
  prompt="make it look like south park style"
/>
```

## rendering video

### text-to-video generation

```tsx
import { Video } from "@vargai/react";

// generate video from prompt
<Video prompt="ocean waves crashing on beach, cinematic" model={fal.videoModel("wan-2.5")} />

// use existing video file
<Video src="./interview.mp4" />

// with audio and trimming
<Video src="./clip.mp4" keepAudio volume={0.8} cutFrom={5} cutTo={15} />
```

### image-to-video animation

```tsx
import { Animate } from "@vargai/react";

// animate an image
<Animate 
  image={<Image prompt="fat tiger on couch" />}
  motion="fat tiger breathing heavily, belly jiggles"
  duration={5}
/>

// from existing file
<Animate 
  src="./luigi.png"
  motion="wheelchair spinning in circles"
  duration={5}
/>
```

## rendering speech

```tsx
import { Speech } from "@vargai/react";

<Clip>
  <Image prompt="ralph wiggum at podium, simpsons style" />
  <Speech voice="adam">
    I'm in danger. Also I'm the CEO now.
  </Speech>
</Clip>
```

voices: `rachel`, `adam`, `bella`, `sam`, `josh`

## talking heads

compose Image, Animate, and Speech to create talking characters:

```tsx
import { Clip, Image, Animate, Speech } from "@vargai/react";
import { fal, elevenlabs } from "@vargai/sdk";

// define a reusable TalkingHead component
const TalkingHead = ({ character, voice, children }: {
  character: string;
  voice: string;
  children: string;
}) => (
  <>
    <Animate 
      image={<Image prompt={character} model={fal.imageModel("flux-schnell")} />}
      model={fal.videoModel("wan-2.5")}
      motion="subtle talking, head movements, blinking"
    />
    <Speech voice={voice} model={elevenlabs.speechModel("turbo")}>
      {children}
    </Speech>
  </>
);

// use it
<Clip duration="auto">
  <TalkingHead character="south park cartman, angry face" voice="adam">
    Screw you guys, I'm going home. But first let me tell you 
    about our sponsor, NordVPN.
  </TalkingHead>
</Clip>
```

this internally:
1. generates character image from prompt
2. generates speech audio from text  
3. animates image to video
4. sets clip duration to match audio length

all steps cached independently.

### with existing image

```tsx
const TalkingHead = ({ src, voice, children }) => (
  <>
    <Animate 
      src={src}
      model={fal.videoModel("wan-2.5")}
      motion="talking naturally"
    />
    <Speech voice={voice} model={elevenlabs.speechModel("turbo")}>
      {children}
    </Speech>
  </>
);

<Clip duration="auto">
  <TalkingHead src="./fat-tiger.png" voice="josh">
    I'm not fat, I'm cultivating mass.
  </TalkingHead>
</Clip>
```

## overlays and pip

layer children stack on top of each other.

```tsx
<Clip duration={5}>
  {/* base layer - full frame */}
  <Image prompt="luigi wheelchair racing track" />
  
  {/* picture-in-picture overlay */}
  <TalkingHead
    character="white-teeth black athletic guy, sports commentator"
    voice="josh"
    position={{ right: "5%", bottom: "5%" }}
    size={{ width: "25%", height: "25%" }}
  >
    And he's approaching the final turn! Incredible speed!
  </TalkingHead>
</Clip>
```

### position presets

```tsx
<Image position="top-left" />
<Image position="top" />
<Image position="top-right" />
<Image position="left" />
<Image position="center" />
<Image position="right" />
<Image position="bottom-left" />
<Image position="bottom" />
<Image position="bottom-right" />
```

## text overlays

```tsx
import { Title, Subtitle } from "@vargai/react";

<Clip duration={5}>
  <Image prompt="ralph wiggum staring blankly" />
  
  {/* centered title */}
  <Title>I'M IN DANGER</Title>
  
  {/* positioned title */}
  <Title position="top" color="#ffffff">
    Episode 1
  </Title>
  
  {/* subtitle with background */}
  <Subtitle>the beginning of something special</Subtitle>
</Clip>
```

### text timing

text appears and disappears within the clip:

```tsx
<Clip duration={10}>
  <Image prompt="fat tiger sleeping timelapse" />
  
  {/* appears at 2s, disappears at 5s */}
  <Title start={2} end={5}>
    Hour 1: Still sleeping
  </Title>
  
  {/* appears at 6s, stays until clip ends */}
  <Title start={6}>
    Hour 47: Still sleeping
  </Title>
</Clip>
```

## captions (tiktok-style)

word-by-word animated captions synced to speech:

```tsx
import { Captions } from "@vargai/react";

<Clip>
  <Video src="./cartman-rant.mp4" />
  <Captions 
    src="./cartman-rant.mp4"
    style="tiktok"
    color="#ffffff"
    activeColor="#ffff00"
    fontSize={48}
  />
</Clip>
```

or feed it a speech element directly:

```tsx
<Clip>
  <Image prompt="ralph wiggum at podium" />
  <Speech voice="adam" id="ralph-speech">
    I'm in danger. The danger is me.
  </Speech>
  <Captions 
    src={ralph-speech}
    style="tiktok"
  />
</Clip>
```

### caption styles

```tsx
<Captions src="./audio.mp3" style="tiktok" />     // word-by-word highlight
<Captions src="./audio.mp3" style="karaoke" />    // fill left-to-right
<Captions src="./audio.mp3" style="bounce" />     // words bounce in
<Captions src="./audio.mp3" style="typewriter" /> // typing effect
```

### with custom transcript

```tsx
<Clip>
  <Video src="./video.mp4" />
  <Captions srt="./captions.srt" style="tiktok" />
</Clip>
```

## split screen

```tsx
import { Split } from "@vargai/react";

<Clip duration={5}>
  <Split direction="horizontal">
    <Animate 
      image={<Image prompt="fat tiger on couch, lazy" />}
      motion="breathing heavily, not moving"
    />
    <Animate 
      image={<Image prompt="fat tiger slightly less fat, still on couch" />}
      motion="breathing slightly less heavily"
    />
  </Split>
  <Title position="bottom">WEEK 1 / WEEK 52</Title>
</Clip>
```

## slider (before/after reveal)

animated wipe reveal between two images:

```tsx
import { Slider } from "@vargai/react";

<Clip duration={5}>
  <Slider direction="horizontal">
    <Image prompt="luigi standing normally" />
    <Image prompt="luigi in wheelchair, looking defeated" />
  </Slider>
  <Title position="top">What racing does to a mf</Title>
</Clip>
```

the slider animates from left to right, revealing the second image.

## swipe animation

tinder-style card swipes:

```tsx
import { Swipe } from "@vargai/react";

<Clip duration={6}>
  <Swipe direction="right" interval={1.5}>
    <Image prompt="ralph wiggum dating profile, eating paste" />
    <Image prompt="fat tiger dating profile, lying down" />
    <Image prompt="luigi wheelchair dating profile, sad eyes" />
    <Image prompt="white-teeth guy dating profile, perfect smile" />
  </Swipe>
</Clip>
```

## packshot (end card)

end card with call-to-action button:

```tsx
import { Packshot } from "@vargai/react";

<Clip duration={4}>
  <Packshot
    background={<Image prompt="south park style gradient" />}
    logo="./cartman-enterprises.png"
    cta="Respect My Authority"
    ctaColor="#ff5500"
    blinkCta
  />
</Clip>
```

## audio

### background music

```tsx
<Render>
  {/* loops to match video duration */}
  <Music prompt="epic orchestral, hero music" loop />
  
  <Clip duration={5}>
    <Image prompt="luigi wheelchair training montage" />
  </Clip>
  
  <Clip duration={5}>
    <Image prompt="luigi wheelchair racing final lap" />
  </Clip>
</Render>
```

### preserve source audio

```tsx
<Clip>
  <Video src="./interview.mp4" keepAudio volume={0.8} />
</Clip>
```

### mix multiple audio

```tsx
<Clip duration={10}>
  <Video src="./fat-tiger-sleeping.mp4" keepAudio volume={0.3} />
  <Speech voice="sam" volume={1.0}>
    Day 47. He still hasn't moved. Scientists are baffled.
  </Speech>
</Clip>
```

### audio ducking

automatically lower music when speech plays:

```tsx
<Render>
  <Music prompt="dramatic documentary music" loop ducking />
  
  <Clip duration={5}>
    <Image prompt="ralph wiggum walking into frame" />
  </Clip>
  
  <Clip duration={10}>
    <Image prompt="ralph wiggum close up, confused" />
    <Speech voice="josh">
      This is ralph. He doesn't know where he is. Neither do we.
    </Speech>
  </Clip>
</Render>
```

### audio normalization

```tsx
<Render normalize>
  {/* all audio levels balanced automatically */}
  <Clip>
    <Video src="./loud-clip.mp4" keepAudio />
  </Clip>
  <Clip>
    <Video src="./quiet-clip.mp4" keepAudio />
  </Clip>
</Render>
```

## character consistency

reuse the same image reference for consistency:

```tsx
const luigi = <Image prompt="luigi in wheelchair, determined face, mario kart style" />;

<Render>
  <Clip duration={3}>
    {luigi}
    <Title>ORIGIN STORY</Title>
  </Clip>
  
  <Clip duration={5}>
    <Animate image={luigi} motion="wheelchair wheels spinning, wind in mustache" />
  </Clip>
  
  <Clip duration={3}>
    {luigi}
    <Title>HE NEVER RECOVERED</Title>
  </Clip>
</Render>
```

same `luigi` reference = same cache key = same generated image.

## elements and scene composition

define reusable elements for consistent generation:

```tsx
import { Element, scene } from "@vargai/react";

// define a character element
const tiger = Element({
  type: "character",
  prompt: "fat tiger, orange stripes, chubby cheeks, sleepy eyes",
});

// define a style element  
const style = Element({
  type: "style",
  prompt: "pixar animation style, soft lighting",
});

// use in scene template
<Image prompt={scene`${tiger} lying on couch, ${style}`} />
<Image prompt={scene`${tiger} attempting to exercise, ${style}`} />
```

elements ensure visual consistency across multiple generations.

## slideshow

```tsx
const SCENES = [
  "at the gym, confused by equipment",
  "eating entire pizza, no regrets",
  "attempting yoga, stuck",
  "napping on treadmill",
];

const character = "fat tiger, chubby, adorable";

<Render width={1280} height={720}>
  <Music prompt="motivational gym music, ironic" loop />
  
  {SCENES.map((scene, i) => (
    <Clip key={i} duration={3} transition={{ name: "fade", duration: 0.3 }}>
      <Image prompt={`${character}, ${scene}`} zoom="in" />
    </Clip>
  ))}
</Render>
```

## character grid

```tsx
const CHARACTERS = [
  { name: "Ralph", prompt: "ralph wiggum, eating glue, happy" },
  { name: "Fat Tiger", prompt: "fat tiger, lying down, exhausted" },
  { name: "Luigi", prompt: "luigi in wheelchair, sad but determined" },
  { name: "The Smile", prompt: "white-teeth black athletic guy, perfect smile, shiny" },
];

<Render width={720} height={720}>
  {CHARACTERS.map(({ name, prompt }) => (
    <Clip key={name} duration={2} transition={{ name: "fade", duration: 0.3 }}>
      <Image prompt={`${prompt}, portrait, meme style`} aspectRatio="1:1" />
      <Title position="bottom" color="#ffffff">{name}</Title>
    </Clip>
  ))}
</Render>
```

## conditional rendering

standard jsx conditionals:

```tsx
<Render>
  <Clip duration={5}>
    <Image prompt="south park cartman main scene" />
  </Clip>
  
  {includeOutro && (
    <Clip duration={3}>
      <Image prompt="cartman waving goodbye" />
      <Title>Screw you guys!</Title>
    </Clip>
  )}
  
  {sponsor && (
    <Clip duration={5}>
      <Image prompt="cartman holding sponsor product" />
      <Speech voice="adam">{sponsor.script}</Speech>
    </Clip>
  )}
</Render>
```

## render options

```tsx
import { render } from "@vargai/react";

// save to file
await render(<Render>...</Render>, { 
  output: "output/video.mp4" 
});

// with cache directory
await render(<Render>...</Render>, { 
  output: "output/video.mp4",
  cache: ".cache/ai"
});

// get buffer
const buffer = await render(<Render>...</Render>);
await Bun.write("video.mp4", buffer);

// stream progress
const stream = render.stream(<Render>...</Render>);
for await (const event of stream) {
  console.log(`${event.type}: ${event.progress}%`);
  // "generating image: 45%"
  // "generating speech: 100%"
  // "rendering clip: 30%"
}
```

## full example: ralph explains crypto

```tsx
import { render, Render, Clip, Image, Animate, Speech, Title } from "@vargai/react";
import { fal, elevenlabs } from "@vargai/sdk";

// TalkingHead is just a composition of primitives
const TalkingHead = ({ character, voice, children }: {
  character: string;
  voice: string;
  children: string;
}) => (
  <Clip duration="auto">
    <Animate 
      image={<Image prompt={character} model={fal.imageModel("flux-schnell")} />}
      model={fal.videoModel("wan-2.5")}
      motion="subtle head movements, blinking, mouth moving"
    />
    <Speech voice={voice} model={elevenlabs.speechModel("turbo")}>
      {children}
    </Speech>
  </Clip>
);

const script = `Hi, I'm Ralph! My cat's breath smells like cat food. 
Also I invested my lunch money in dogecoin. 
Now I live in a box. But it's a nice box! 
It has a window. The window is a hole.`;

await render(
  <Render width={1080} height={1920}>
    <TalkingHead
      character="ralph wiggum, simpsons style, innocent smile, slightly confused"
      voice="adam"
    >
      {script}
    </TalkingHead>
    
    <Clip duration={2} transition={{ name: "fade", duration: 0.5 }}>
      <Image 
        prompt="ralph wiggum in cardboard box, happy, simpsons style"
        model={fal.imageModel("flux-schnell")}
        zoom="in"
      />
      <Title position="bottom">@RalphInvests</Title>
    </Clip>
  </Render>,
  { 
    output: "output/ralph-crypto.mp4",
    cache: ".cache/ai"
  }
);
```

## full example: wheelchair racing promo

```tsx
import { render, Render, Clip, Image, Animate, Title, Subtitle, Music } from "@vargai/react";

const luigi = <Image prompt="luigi in racing wheelchair, determined, mario kart style" />;

await render(
  <Render width={1080} height={1920}>
    <Music prompt="epic racing music, fast drums, intense" loop />
    
    <Clip duration={3}>
      {luigi}
      <Title start={1}>This Summer</Title>
    </Clip>
    
    <Clip duration={5} transition={{ name: "fade", duration: 0.5 }}>
      <Animate 
        image={luigi}
        motion="wheelchair wheels spinning fast, wind effects, speed lines"
      />
      <Title position="bottom">NO LIMITS</Title>
    </Clip>
    
    <Clip duration={3} transition={{ name: "fade", duration: 0.5 }}>
      {luigi}
      <Title>LUIGI KART: WHEELCHAIR EDITION</Title>
      <Subtitle>He can't walk but he can win</Subtitle>
    </Clip>
  </Render>,
  { output: "output/luigi-promo.mp4" }
);
```

## full example: fat tiger's fitness journey

```tsx
import { render, Render, Clip, Image, Animate, Split, Title } from "@vargai/react";

const tiger = "fat tiger, orange stripes, cute, pixar style";

const before = <Image prompt={`${tiger}, extremely chubby, on couch, pizza boxes`} aspectRatio="3:4" />;
const after = <Image prompt={`${tiger}, slightly less chubby, still on couch, salad nearby unopened`} aspectRatio="3:4" />;

await render(
  <Render width={1280} height={720}>
    <Clip duration={5}>
      <Split direction="horizontal">
        <Animate image={before} motion="breathing heavily, belly jiggles" />
        <Animate image={after} motion="breathing slightly less heavily, one ear twitches" />
      </Split>
      <Title position="bottom" color="#ffffff">
        DAY 1                    DAY 365
      </Title>
    </Clip>
  </Render>,
  { output: "output/tiger-transformation.mp4" }
);
```

## models

specify which ai model to use:

```tsx
import { Image, Animate, Speech, TalkingHead } from "@vargai/react";
import { fal, openai, replicate, elevenlabs, higgsfield } from "@vargai/sdk";

// image models
<Image prompt="sunset" model={fal.imageModel("flux-schnell")} />
<Image prompt="sunset" model={fal.imageModel("flux-pro")} />
<Image prompt="sunset" model={openai.imageModel("dall-e-3")} />
<Image prompt="sunset" model={replicate.imageModel("sdxl")} />

// video models
<Animate model={fal.videoModel("kling-v2.5")} motion="slow zoom" />
<Animate model={fal.videoModel("wan-2.5")} motion="camera pan" />
<Animate model={higgsfield.videoModel("soul")} motion="walking" />

// speech models
<Speech model={elevenlabs.speechModel("turbo")} voice="rachel">
  hello world
</Speech>

// talking head with lipsync
<TalkingHead 
  model={fal.videoModel("wan-2.5")}
  lipsyncModel={fal.videoModel("sync-v2")}
  voice="adam"
>
  this syncs lips to speech
</TalkingHead>
```

### higgsfield characters

for consistent character animation:

```tsx
<Render>
  <Clip duration={5}>
    <Animate
      model={higgsfield.videoModel("soul")}
      character="white-teeth-guy"
      motion="walking forward with perfect posture, teeth gleaming"
    />
  </Clip>
  
  <Clip duration={5}>
    <Animate
      model={higgsfield.videoModel("soul")}
      character="white-teeth-guy"
      motion="pointing at camera, smile intensifies"
    />
  </Clip>
</Render>
```

same `character` id = consistent appearance across clips.

## why varg-react?

| imperative (current) | declarative (varg-react) |
|---------------------|-------------------------|
| manual cache keys | automatic from props |
| step-by-step generation | parallel where possible |
| explicit file handling | automatic temp files |
| editly config objects | jsx composition |
| ~50 lines for talking head | ~10 lines |

same power, less code, automatic caching.
