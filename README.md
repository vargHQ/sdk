# varg

AI video generation from your terminal.

## Quick Start

```bash
bun install @vargai/sdk
```

```bash
varg run image --prompt "cyberpunk cityscape at night"
varg run video --prompt "camera flies through clouds" --duration 5
varg run voice --text "Hello world" --voice rachel
```

## Commands

| Command | Description |
|---------|-------------|
| `varg run <action>` | Run an action |
| `varg list` | List all available actions |
| `varg find <query>` | Search actions by keyword |
| `varg which <action>` | Show action details and options |
| `varg help` | Show help |

## Actions

| Action | Description | Example |
|--------|-------------|---------|
| `image` | Generate image from text | `varg run image --prompt "sunset"` |
| `video` | Generate video from text or image | `varg run video --prompt "ocean waves" --image ./photo.jpg` |
| `voice` | Text-to-speech | `varg run voice --text "Hello" --voice sam` |
| `music` | Generate music | `varg run music --prompt "upbeat electronic"` |
| `transcribe` | Audio to text/subtitles | `varg run transcribe --audio ./speech.mp3` |
| `captions` | Add subtitles to video | `varg run captions --video ./clip.mp4` |
| `sync` | Lipsync audio to video | `varg run sync --video ./face.mp4 --audio ./voice.mp3` |
| `trim` | Trim video | `varg run trim --input ./video.mp4 --start 0 --end 10` |
| `cut` | Remove section from video | `varg run cut --input ./video.mp4 --start 5 --end 8` |
| `merge` | Combine videos | `varg run merge --inputs ./a.mp4 ./b.mp4` |
| `split` | Split video at timestamps | `varg run split --input ./video.mp4 --timestamps 10,20,30` |
| `fade` | Add fade in/out | `varg run fade --input ./video.mp4 --type both` |
| `transition` | Add transitions between clips | `varg run transition --inputs ./a.mp4 ./b.mp4` |
| `upload` | Upload file to S3 | `varg run upload --file ./video.mp4` |

Use `varg run <action> --help` for all options.

## Environment Variables

<details>
<summary>Required API keys</summary>

```bash
# AI Providers
FAL_API_KEY=fal_xxx
REPLICATE_API_TOKEN=r8_xxx
ELEVENLABS_API_KEY=xxx
GROQ_API_KEY=gsk_xxx
FIREWORKS_API_KEY=fw_xxx
HIGGSFIELD_API_KEY=hf_xxx
HIGGSFIELD_SECRET=secret_xxx

# Storage (Cloudflare R2)
CLOUDFLARE_R2_API_URL=https://xxx.r2.cloudflarestorage.com
CLOUDFLARE_ACCESS_KEY_ID=xxx
CLOUDFLARE_ACCESS_SECRET=xxx
CLOUDFLARE_R2_BUCKET=bucket-name
```

</details>

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup.

## License

Apache-2.0 — see [LICENSE.md](LICENSE.md)
