---
name: varg-studio
description: Launch varg studio visual editor to preview and edit video projects. Use when user wants to open, preview, or edit a .tsx video file in the browser-based editor.
license: MIT
metadata:
  author: vargHQ
  version: "1.0.0"
compatibility: Requires bun runtime.
allowed-tools: Bash(bun:*)
---

# Varg Studio

Launch the visual editor for varg video workflows in a browser-based interface.

## Quick Start

```bash
# Launch studio (empty)
bun run src/cli/index.ts studio

# Launch with a specific file
bun run src/cli/index.ts studio path/to/video.tsx
```

## Command Syntax

```bash
bun run src/cli/index.ts studio [file] [--port=PORT] [--cache=DIR]
```

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `file` (positional) | none | Initial file to open in editor |
| `--port` | 8282 | Port to run server on |
| `--cache` | .cache/ai | Cache directory for generated assets |

## Examples

```bash
# Open a specific project file
bun run src/cli/index.ts studio my-video.tsx

# Open file on custom port
bun run src/cli/index.ts studio my-video.tsx --port=3000

# Open file with custom cache directory
bun run src/cli/index.ts studio my-video.tsx --cache=.my-cache

# Launch empty studio on port 9000
bun run src/cli/index.ts studio --port=9000
```

## Available Routes

Once running, open in browser at `http://localhost:PORT`:

| Route | Description |
|-------|-------------|
| `/editor` | Code editor for video projects |
| `/cache` | Cache viewer for generated assets |

## Typical Workflow

1. Create or edit a video `.tsx` file
2. Launch studio with the file: `bun run src/cli/index.ts studio my-video.tsx`
3. Open `http://localhost:8282/editor` in browser
4. Preview and iterate on the video

## Example

See [examples/portrait.tsx](examples/portrait.tsx) for a complete example:

```bash
bun run src/cli/index.ts studio skills/varg-studio/examples/portrait.tsx
```

This example demonstrates:
- Image generation with reference images using `fal.imageModel("nano-banana-pro/edit")`
- Video generation from the portrait using `fal.videoModel("kling-v2.5")`
- Portrait format (1080x1920) for social media
