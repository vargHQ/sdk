# vargai/characters

Pre-built character definitions for AI video generation. Each character includes detailed prompts, motion descriptions, and styling information.

## Installation

Characters are included in the vargai package:

```bash
bun install vargai
```

## Usage

```typescript
import { Madi, BusinessCat, KawaiiOrange } from "vargai/characters";
import { fal } from "vargai/ai";
import { Image, Video, Render, Clip } from "vargai/react";

// Use a prompt-only character
const catVideo = (
  <Render>
    <Clip duration={5}>
      <Video
        prompt={BusinessCat.prompt}
        model={fal.videoModel("wan-2.5")}
      />
    </Clip>
  </Render>
);

// Use a character with image reference
const madiVideo = (
  <Render>
    {Madi.scenes.map((scene) => (
      <Clip key={scene.prompt} duration={2}>
        <Video
          prompt={{
            text: scene.motion,
            images: [
              Image({
                prompt: { text: scene.prompt, images: [Madi.imageRef] },
                model: fal.imageModel("nano-banana-pro/edit"),
              }),
            ],
          }}
          model={fal.videoModel("wan-2.5")}
        />
      </Clip>
    ))}
  </Render>
);
```

## Characters

### Prompt-Only (no image reference needed)

| Character | Description | Best For |
|-----------|-------------|----------|
| `BusinessCat` | Sophisticated tabby cat in business suit | Comedy, memes, corporate parody |
| `KawaiiOrange` | Cute fluffy orange fruit character | Kids content, animations |
| `KawaiiStrawberry` | Cute fluffy strawberry character | Kids content, animations |
| `TechReviewer` | Friendly young man with glasses | Product demos, talking heads |
| `TransformationWoman` | Before/after fitness character | UGC ads, fitness content |

### With Image Reference

| Character | Description | Best For |
|-----------|-------------|----------|
| `Madi` | Expressive woman with multiple scenes | TikTok-style content |
| `ElegantWoman` | Sophisticated woman with pose variations | Fashion, lifestyle |
| `AsianInfluencer` | East Asian woman for branded content | Talking heads, influencer |
| `NoirPortrait` | Dramatic noir aesthetic portrait | Editorial, fashion |
| `SlavicAthlete` | Athletic woman in sportswear | Fitness, UGC |

## Character Types

### Simple Character (prompt-only)

```typescript
interface Character {
  name: string;
  description: string;
  prompt: string;
  style: string;
  tags: string[];
}
```

### Character with Reference

```typescript
interface CharacterWithReference {
  name: string;
  description: string;
  imageRef: string;       // URL to reference image
  scenes?: Array<{        // Multiple scene variations
    prompt: string;
    motion: string;
  }>;
  style: string;
  tags: string[];
}
```

## Examples

### Generate a kawaii animation

```typescript
import { KawaiiOrange } from "vargai/characters";

<Video
  prompt={{
    text: "character waves hello enthusiastically, bounces up and down",
    images: [Image({ prompt: KawaiiOrange.prompt, model: fal.imageModel("nano-banana-pro") })],
  }}
  model={fal.videoModel("kling-v2.5")}
/>
```

### Create a transformation video

```typescript
import { TransformationWoman } from "vargai/characters";

<SplitLayout
  left={
    <Video
      prompt={{ text: TransformationWoman.beforeMotion, images: [beforeImage] }}
      model={fal.videoModel("kling-v2.5")}
    />
  }
  right={
    <Video
      prompt={{ text: TransformationWoman.afterMotion, images: [afterImage] }}
      model={fal.videoModel("kling-v2.5")}
    />
  }
/>
```
