# agent skills

this repo exposes a small set of claude code skills plus a cli. use skills for guidance and run the cli to produce outputs.

## available skills

1. **varg-video-generation** (`skills/varg-video-generation/`)
   - generate videos with the react engine
   - agent should create tsx if needed, then run a render after confirmation
   - cli: `bun run src/cli/index.ts render <file.tsx> [-o output.mp4]`
   - preview: `bun run src/cli/index.ts preview <file.tsx>`

2. **vargai-pipeline-cookbooks** (`skills/vargai-pipeline-cookbooks/`)
   - end-to-end workflows (talking character, text-to-tiktok, round selfie, trendwatching, remotion)
   - source cookbooks in `pipeline/cookbooks/`

## agent execution policy (important)

- ask for confirmation before running any command that triggers paid api calls
- if the user explicitly says "run/render/generate now," proceed without extra confirmation
- prefer cli execution over leaving tsx files unrun
- write outputs to `output/` and do not commit new outputs

## cli actions (non-skill)

use `varg run` for single-step actions:

```bash
bun run src/cli/index.ts run image|video|voice|music|transcribe|captions|sync|upload|edit --help
```

## see also

- [README.md](README.md) - sdk overview and installation
- [docs/react.md](docs/react.md) - jsx rendering
- [docs/sdk.md](docs/sdk.md) - ai sdk usage
- [pipeline/cookbooks/talking-character.md](pipeline/cookbooks/talking-character.md) - talking character workflow
- [pipeline/cookbooks/round-video-character.md](pipeline/cookbooks/round-video-character.md) - telegram round selfie video cookbook
- [pipeline/cookbooks/trendwatching.md](pipeline/cookbooks/trendwatching.md) - discover viral tiktok content
