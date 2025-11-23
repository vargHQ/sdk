# agent skills

this sdk includes claude code agent skills for each service. each skill is co-located with its service code.

## available skills

### service skills

located in `service/<name>/SKILL.md`:

1. **image-generation** (`service/image/`)
   - generate ai images using fal (flux models) or higgsfield soul characters
   - cli: `bun run service/image fal|soul <prompt> [options]`

2. **video-generation** (`service/video/`)
   - generate videos from images (local or url) or text prompts using fal.ai
   - supports local image files - automatically uploads to fal storage
   - cli: `bun run service/video from_image|from_text <args>`

3. **voice-synthesis** (`service/voice/`)
   - generate realistic text-to-speech audio using elevenlabs
   - cli: `bun run service/voice generate|elevenlabs <text> [options]`

3b. **music-generation** (`lib/elevenlabs.ts`)
   - generate music from text prompts using elevenlabs
   - generate sound effects from descriptions
   - cli: `bun run lib/elevenlabs.ts music|sfx <prompt> [options]`

4. **video-lipsync** (`service/sync/`)
   - sync video with audio using wav2lip or simple overlay
   - cli: `bun run service/sync sync|wav2lip|overlay <args>`

5. **video-captions** (`service/captions/`)
   - add auto-generated or custom subtitles to videos
   - cli: `bun run service/captions <videoPath> [options]`

6. **video-editing** (`service/edit/`)
   - edit videos with ffmpeg (resize, trim, concat, social media prep)
   - cli: `bun run service/edit social|montage|trim|resize|merge_audio <args>`

7. **audio-transcription** (`service/transcribe/`)
   - transcribe audio to text or subtitles using groq/fireworks
   - cli: `bun run service/transcribe <audioUrl> <provider> [outputPath]`

### pipeline skills

located in `pipeline/cookbooks/SKILL.md`:

8. **talking-character-pipeline** (`pipeline/cookbooks/`)
   - complete workflow to create talking character videos
   - combines: character generation → voiceover → animation → lipsync → captions → social prep

9. **round-video-character** (`pipeline/cookbooks/round-video-character.md`)
   - create realistic round selfie videos for telegram using nano banana pro + wan 2.5
   - workflow: generate selfie first frame (person in setting) → voiceover → wan 2.5 video
   - uses: `bun run lib/fal.ts`, `bun run lib/replicate.ts`, `bun run lib/elevenlabs.ts`
   - input: text script + profile photo
   - output: extreme close-up selfie video with authentic camera shake, lighting, and audio

## structure

each skill follows this pattern:

```
service/<name>/
├── index.ts      # service implementation
└── SKILL.md      # claude code agent skill
```

## how skills work

skills are **model-invoked** - claude autonomously decides when to use them based on your request and the skill's description.

**example:**
- you say: "create a talking character video"
- claude reads `talking-character-pipeline` skill
- claude executes the workflow using the pipeline steps

## using skills

### in claude code

skills are automatically discovered when you're in the sdk directory:

```
user: create an image of a sunset
claude: [uses image-generation skill]
        bun run service/image fal "beautiful sunset over mountains"
```

### manually

you can also run services directly:

```bash
# generate image
bun run service/image fal "sunset over mountains" true

# generate video from that image
bun run service/video from_image "camera pan" https://image-url.jpg 5 true

# add voice
bun run service/voice elevenlabs "this is a beautiful sunset" rachel true

# sync with video
bun run service/sync wav2lip https://video-url.mp4 https://audio-url.mp3
```

## skill features

each skill includes:

- **name**: unique skill identifier
- **description**: when claude should use this skill
- **allowed-tools**: restricted to Read, Bash for safety
- **usage examples**: cli and programmatic examples
- **when to use**: specific use cases
- **tips**: best practices
- **environment variables**: required api keys

## benefits

- **discoverability**: claude knows all available services
- **context**: skills provide usage examples and best practices
- **safety**: `allowed-tools` limits to read-only and bash execution
- **documentation**: skills serve as living documentation

## skill reference

| skill | service | primary use case |
|-------|---------|------------------|
| image-generation | image | create ai images, character headshots |
| video-generation | video | animate images, generate video clips |
| voice-synthesis | voice | text-to-speech, voiceovers |
| music-generation | elevenlabs | generate music, create sound effects |
| video-lipsync | sync | sync audio with video, talking characters |
| video-captions | captions | add subtitles, accessibility |
| video-editing | edit | resize, trim, social media optimization |
| audio-transcription | transcribe | speech-to-text, subtitle generation |
| talking-character-pipeline | pipeline | end-to-end talking character videos |
| round-video-character | pipeline | telegram round selfie videos with wan 2.5 |

## see also

- [README.md](README.md) - sdk overview and installation
- [STRUCTURE.md](STRUCTURE.md) - detailed module organization
- [pipeline/cookbooks/talking-character.md](pipeline/cookbooks/talking-character.md) - talking character workflow
- [pipeline/cookbooks/round-video-character.md](pipeline/cookbooks/round-video-character.md) - telegram round selfie video cookbook
