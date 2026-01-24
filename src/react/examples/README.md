# Launch Videos

Pre-made video templates for vargai launch and demo purposes.

## Videos

| # | File | Description | Duration |
|---|------|-------------|----------|
| 1 | `01-hero.tsx` | Hero showcase - all capabilities in 15s | ~15s |
| 2 | `02-talking-head.tsx` | AI presenter explaining vargai | ~25s |
| 3 | `03-slideshow.tsx` | Dreamy AI-generated slideshow with music | ~25s |
| 4 | `04-tiktok-style.tsx` | TikTok-style character video | ~10s |
| 5 | `05-simple-demo.tsx` | Simplest possible video (one clip) | ~5s |

## How to Render

```bash
# Preview mode (fast, uses placeholders)
bunx vargai render launch-videos/01-hero.tsx --preview

# Full render (uses AI generation)
bunx vargai render launch-videos/01-hero.tsx

# Output to specific path
bunx vargai render launch-videos/01-hero.tsx -o my-video.mp4
```

## Requirements

- `FAL_API_KEY` - Required for image/video generation
- `ELEVENLABS_API_KEY` - Required for music/voice (videos 1, 2, 3, 4)

## Output

Videos are rendered to `output/` by default:
- `output/01-hero.mp4`
- `output/02-talking-head.mp4`
- etc.

## Customization

Each file is a self-contained TSX component. Edit prompts, durations, or add/remove clips as needed.
