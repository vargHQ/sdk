<p align="center">
  <h1 align="center">varg — Agentic AI Video Generation SDK</h1>
  <p align="center">One SDK for Kling, Flux, ElevenLabs and more. Built on Vercel AI SDK.</p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/vargai"><img src="https://img.shields.io/npm/v/vargai.svg" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/vargai"><img src="https://img.shields.io/npm/dm/vargai.svg" alt="npm downloads"></a>
  <a href="https://github.com/vargHQ/sdk/stargazers"><img src="https://img.shields.io/github/stars/vargHQ/sdk" alt="GitHub stars"></a>
  <a href="https://github.com/vargHQ/sdk/blob/main/LICENSE.md"><img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="License"></a>
</p>

<p align="center">
  <a href="https://docs.varg.ai">Docs</a> &middot; <a href="https://app.varg.ai">Dashboard</a> &middot; <a href="https://docs.varg.ai/quickstart">Quickstart</a> &middot; <a href="https://docs.varg.ai/sdk/models">Models</a> &middot; <a href="https://discord.gg/varg">Discord</a>
</p>

---

> [!WARNING]
> **JSX/TSX videos are deprecated.** `vargai/react` (`<Render>`, `<Clip>`, `<Video>`…), `vargai/studio` and the JSX runtime still work but get no new features, and `render()` prints a `DeprecationWarning` (code `VARGAI_JSX`). The CLI no longer renders: `vargai render`, `preview`, `frame`, `storyboard`, `studio` and `hello` were removed.
>
> Generate with the [varg API](https://docs.varg.ai) or the varg MCP tools and edit with the ffmpeg tool, from the terminal:
>
> ```bash
> curl -fsSL https://varg.ai/install | sh
> vargai login
> vargai generate_video --prompt "waves at dusk" --duration 5
> vargai call_tool '{"tool":"ffmpeg","input":{...}}'
> ```
>
> The rest of this README describes the deprecated JSX API.

**varg** is an open-source TypeScript SDK for AI video generation. One API key, one API — generate images, video, speech, music, lipsync, and captions through `varg.*` providers. Write videos as JSX components (like React), render locally or in the cloud.

## Get started

### For AI agents (recommended)

Install the varg skill into Claude Code, Cursor, Windsurf, or any agent that supports skills. Zero code — just prompt.

```bash
# 1. Install the varg skill
npx -y skills add vargHQ/skills --all --copy -y

# 2. Set your API key (get one at app.varg.ai)
export VARG_API_KEY=varg_live_xxx

# 3. Create your first video
claude "create a 10-second product video for white sneakers, 9:16, UGC style, with captions and background music"
```

The agent writes declarative JSX, varg handles AI generation + caching + rendering.

### For developers

```bash
# Install with bun (recommended)
bun install vargai ai

# Or with npm
npm install vargai ai

# Set up project (auth, skills, cache dirs)
bunx vargai init
```

`vargai init` signs you in, installs the agent skill and sets up your project structure.

Or ask your AI agent to create something from scratch.

## How it works

```
Your prompt / JSX code
        |
   varg API (api.varg.ai/v2)
   /     |      \        \
 Kling  Flux  ElevenLabs  Wan ...   (AI providers)
   \     |      /        /
    varg render engine
        |
   output.mp4
```

- **One API key** (`VARG_API_KEY`) routes to all providers through the varg API
- **Declarative JSX** — compose videos like React components with `<Clip>`, `<Video>`, `<Music>`, `<Captions>`
- **Automatic caching** — same props = instant cache hit at $0. Re-render without re-generating
- **Local or cloud** — render with `render()` from `vargai/react` locally, or submit via the cloud render endpoint (`POST https://api.varg.ai/v2/render`)

## Quick examples

### Image to video

```tsx
import { Render, Clip, Image, Video } from "vargai/react";
import { varg } from "vargai/ai";

const character = Image({
  prompt: "cute kawaii orange cat, round body, big eyes, Pixar style",
  model: varg.imageModel("nano-banana-pro"),
  aspectRatio: "9:16",
});

export default (
  <Render width={1080} height={1920}>
    <Clip duration={5}>
      <Video
        prompt={{ text: "cat waves hello, bounces happily", images: [character] }}
        model={varg.videoModel("kling-v3")}
      />
    </Clip>
  </Render>
);
```

```ts
// render.ts — the CLI no longer renders, so call render() yourself
import { render } from "vargai/react";
import video from "./hello.tsx";
await render(video, { output: "output/hello.mp4" });
```

### With music and captions

```tsx
import { Render, Clip, Image, Video, Speech, Captions, Music } from "vargai/react";
import { varg } from "vargai/ai";

const character = Image({
  model: varg.imageModel("nano-banana-pro"),
  prompt: "friendly robot, blue metallic, expressive eyes",
  aspectRatio: "9:16",
});

const voiceover = Speech({
  model: varg.speechModel("eleven_v3"),
  voice: "adam",
  children: "Hello! I'm your AI assistant. Let me show you something cool!",
});

export default (
  <Render width={1080} height={1920}>
    <Music prompt="upbeat electronic, cheerful" model={varg.musicModel()} volume={0.15} />
    <Clip duration={5}>
      <Video
        prompt={{ text: "robot talking, subtle head movements", images: [character] }}
        model={varg.videoModel("kling-v3")}
      />
    </Clip>
    <Captions src={voiceover} style="tiktok" color="#ffffff" withAudio />
  </Render>
);
```

### Talking head with lipsync

```tsx
import { Render, Clip, Image, Video, Speech, Captions, Music } from "vargai/react";
import { varg } from "vargai/ai";

const voiceover = Speech({
  model: varg.speechModel("eleven_v3"),
  voice: "josh",
  children: "With varg, you can create any videos at scale!",
});

const baseCharacter = Image({
  prompt: "woman, sleek black bob hair, fitted black t-shirt, natural look",
  model: varg.imageModel("nano-banana-pro"),
  aspectRatio: "9:16",
});

const animatedCharacter = Video({
  prompt: {
    text: "woman speaking naturally, subtle head movements, friendly expression",
    images: [baseCharacter],
  },
  model: varg.videoModel("kling-v3"),
});

export default (
  <Render width={1080} height={1920}>
    <Music prompt="modern tech ambient, subtle electronic" model={varg.musicModel()} volume={0.1} />
    <Clip duration={5}>
      <Video
        prompt={{ video: animatedCharacter, audio: voiceover }}
        model={varg.videoModel("sync-v2-pro")}
      />
    </Clip>
    <Captions src={voiceover} style="tiktok" color="#ffffff" withAudio />
  </Render>
);
```

## Components

| Component | Purpose | Key props |
|-----------|---------|-----------|
| `<Render>` | Root container | `width`, `height`, `fps` |
| `<Clip>` | Time segment | `duration`, `transition`, `cutFrom`, `cutTo` |
| `<Image>` | AI or static image | `prompt`, `src`, `model`, `zoom`, `aspectRatio`, `resize` |
| `<Video>` | AI or source video | `prompt`, `src`, `model`, `volume`, `cutFrom`, `cutTo` |
| `<Speech>` | Text-to-speech | `voice`, `model`, `volume`, `children` |
| `<Music>` | Background music | `prompt`, `src`, `model`, `volume`, `loop`, `ducking` |
| `<Title>` | Text overlay | `position`, `color`, `start`, `end` |
| `<Subtitle>` | Subtitle text | `backgroundColor` |
| `<Captions>` | Auto-generated subs | `src`, `srt`, `style`, `color`, `activeColor`, `withAudio` |
| `<Overlay>` | Positioned layer | `left`, `top`, `width`, `height`, `keepAudio` |
| `<Split>` | Side-by-side | `direction` |
| `<Slider>` | Before/after reveal | `direction` |
| `<Swipe>` | Tinder-style cards | `direction`, `interval` |
| `<TalkingHead>` | Animated character | `character`, `src`, `voice`, `model`, `lipsyncModel` |
| `<Packshot>` | End card with CTA | `background`, `logo`, `cta`, `blinkCta` |

### Caption styles

```tsx
<Captions src={voiceover} style="tiktok" />     // word-by-word highlight
<Captions src={voiceover} style="karaoke" />    // fill left-to-right
<Captions src={voiceover} style="bounce" />     // words bounce in
<Captions src={voiceover} style="typewriter" /> // typing effect
```

### Transitions

67 GL transitions available:

```tsx
<Clip transition={{ name: "fade", duration: 0.5 }}>
<Clip transition={{ name: "crossfade", duration: 0.5 }}>
<Clip transition={{ name: "wipeleft", duration: 0.5 }}>
<Clip transition={{ name: "cube", duration: 0.8 }}>
```

## Models

All models are accessed through `varg.*` — one API key, one provider.

```typescript
import { varg } from "vargai/ai";
```

### Video

| Model | Use case | Credits (5s) |
|-------|----------|-------------|
| `varg.videoModel("kling-v3")` | Best quality, latest | 150 |
| `varg.videoModel("kling-v3-standard")` | Good quality, cheaper | 50 |
| `varg.videoModel("kling-v2.5")` | Previous gen, reliable | 50 |
| `varg.videoModel("wan-2.5")` | Good for characters | 50 |
| `varg.videoModel("minimax")` | Alternative | 50 |
| `varg.videoModel("sync-v2-pro")` | Lipsync (video + audio) | 50 |

### Image

| Model | Use case | Credits |
|-------|----------|---------|
| `varg.imageModel("nano-banana-pro")` | Versatile, fast | 5 |
| `varg.imageModel("nano-banana-pro/edit")` | Image-to-image editing | 5 |
| `varg.imageModel("flux-schnell")` | Fast generation | 5 |
| `varg.imageModel("flux-pro")` | High quality | 25 |
| `varg.imageModel("recraft-v3")` | Alternative | 10 |

### Audio

| Model | Use case | Credits |
|-------|----------|---------|
| `varg.speechModel("eleven_v3")` | Text-to-speech | 25 |
| `varg.speechModel("eleven_multilingual_v2")` | Multilingual TTS | 25 |
| `varg.musicModel()` | Music generation | 25 |
| `varg.transcriptionModel("whisper")` | Speech-to-text | 5 |

1 credit = $0.01. Cache hits are always free.

## CLI

```bash
bunx vargai login                              # sign in (email OTP or API key)
bunx vargai init                               # set up project (auth + skills)
bunx vargai balance                            # check credit balance
bunx vargai topup                              # add credits
bunx vargai run image --prompt "sunset"        # generate a single image
bunx vargai run video --prompt "ocean waves"   # generate a single video
bunx vargai list                               # list available models and actions
```

Everything the [varg MCP server](https://github.com/vargHQ/mcp) does is a command too, tool for tool. The standalone `vargai` (one file, no Node or Bun) installs with:

```bash
curl -fsSL https://varg.ai/install | sh        # macOS, Linux
irm https://varg.ai/install.ps1 | iex          # Windows
vargai update                                  # later: the latest release
```

```bash
vargai search "captions for reels"             # varg how to: skills, guides, presets (no key)
vargai install remotion-captions               # install a skill into your agent (no key)
vargai version                                 # this version and the latest (no key)
vargai tools                                   # every MCP tool; ○ = no key needed
vargai login                                   # then: account, balance, every model
vargai generate_image "a red fox"              # any MCP tool, options from its schema
vargai help generate_video                     # a tool's options
```

From the npm package (`bunx vargai …`) the same commands work as `vargai mcp <tool>`, and they use the installed binary when there is one. The SDK commands (`init`, `run`, `list`…) run on Bun either way. The CLI does not render JSX/TSX any more. Releases: [`cli-v*`](https://github.com/vargHQ/sdk/releases).

## Environment

```bash
# Required — one key for everything
VARG_API_KEY=varg_live_xxx
```

Get your API key at [app.varg.ai](https://app.varg.ai). Bun auto-loads `.env` files.

<details>
<summary>Bring your own keys (optional)</summary>

You can use provider keys directly if you prefer:

```bash
FAL_API_KEY=fal_xxx                # fal.ai direct
ELEVENLABS_API_KEY=xxx             # ElevenLabs direct
OPENAI_API_KEY=sk_xxx              # OpenAI / Sora
REPLICATE_API_TOKEN=r8_xxx         # Replicate
KREA_API_KEY=xxx                   # Krea direct (krea.imageModel("krea"))
```

See the [BYOK docs](https://docs.varg.ai/sdk/byok) for details.

</details>

## Pricing

| Action | Model | Credits | Cost |
|--------|-------|---------|------|
| Image | nano-banana-pro | 5 | $0.05 |
| Image | flux-pro | 25 | $0.25 |
| Video (5s) | kling-v3 | 150 | $1.50 |
| Speech | eleven_v3 | 25 | $0.25 |
| Music | music_v1 | 25 | $0.25 |
| Cache hit | any | 0 | $0.00 |

A typical 3-clip video costs $2-5. Cache hits are always free.

## Star History

<img width="2832" height="2253" alt="star-history-202643" src="https://github.com/user-attachments/assets/63e84279-d756-43a9-b328-118fb69ed2d5" />


## Discord 

[https://discord.com/channels/1463766525117861922/1463766526250188824
](https://discord.com/invite/VAecJay7R9)

## Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for development setup.

## License

Apache-2.0 — see [LICENSE.md](LICENSE.md)
