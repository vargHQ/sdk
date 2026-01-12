# VARG SDK - 5 Typical Examples

Based on analysis of 272 production scripts.

## Examples

| # | Example | % of Scripts | Description |
|---|---------|--------------|-------------|
| 1 | `01_simple_ugc.ts` | 40% | Basic UGC: Image → Animation → Voice → Lipsync → Captions |
| 2 | `02_batch_15_characters.ts` | 25% | Campaign with 15 characters, batched processing |
| 3 | `03_postproduction_batch.ts` | 10% | Post-production: captions, aspect ratios, music |
| 4 | `04_hook_body_packshot.ts` | 18% | Ad creative: Hook → Body → B-roll → Packshot |
| 5 | `05_outfit_variations.ts` | 7% | Generate character outfit/environment variations |

## Run

```bash
# Install dependencies
npm install

# Run example
npx ts-node examples/01_simple_ugc.ts
```

## Example 1: Simple UGC (40%)

Most basic pipeline for user-generated content style videos.

```typescript
const { image } = await generateImage({ model: soul, prompt: '...' })
const { video } = await animateImage({ model: kling, image, prompt: '...' })
const { audio } = await generateSpeech({ model: voice, text: '...' })
const { video: lipsynced } = await generateLipsync({ model: lipsync, video, audio })
const { video: final } = await addCaptions({ video: lipsynced, text: '...' })
```

## Example 2: Batch 15 Characters (25%)

Campaign generation with proper batch sizes and rate limiting.

```typescript
// Phase 1: Images (batch of 8)
const images = await batch(characters, generateCharacterImage, { batchSize: 8 })

// Phase 2: Animation (batch of 3 - Kling rate limit)
const videos = await batch(images.results, animateCharacter, { batchSize: 3 })

// Phase 3: Voiceover (batch of 5 - ElevenLabs limit)
const voices = await batch(characters, generateVoiceover, { batchSize: 5 })

// Phase 4: Lipsync (batch of 3)
const finals = await batch(combined, applyLipsync, { batchSize: 3 })
```

## Example 3: Post-Production (10%)

Take existing videos and apply post-processing.

```typescript
// Add captions → Add voiceover → Add music → Convert aspect ratios
const captioned = await batch(videos, addCaptions, { batchSize: 5 })
const withVoice = await batch(captioned.results, addVoiceover, { batchSize: 5 })
const withMusic = await batch(withVoice.results, addMusic, { batchSize: 5 })

// Convert to multiple formats
for (const video of withMusic.results) {
  await convertAspectRatio({ video, targetRatio: '4:5' })
  await convertAspectRatio({ video, targetRatio: '1:1' })
}
```

## Example 4: Ad Creative Assembly (18%)

Full ad structure with hook, body, b-roll, and packshot.

```typescript
// 1. Hook (5s) - attention grabber
const { video: hook } = await animateImage({ image, prompt: hookAction, duration: 5 })

// 2. Body (15s) - testimonial with lipsync
const { video: body } = await generateLipsync({ video: talking, audio: voice })

// 3. B-roll (6s) - product footage with text
const broll = await addTitle({ video: footage, title: 'Key Benefits' })

// 4. Packshot (5s) - CTA
const { video: packshot } = await createPackshot({ title, button, background })

// 5. Assemble
const { video: final } = await concatVideos({
  videos: [hook, body, broll, packshot],
  transition: 'crossfade',
})
```

## Example 5: Outfit Variations (7%)

Generate multiple variations of same character.

```typescript
// Generate base character
const { image: base } = await generateImage({ model: soul, prompt: basePrompt })

// Transform to variations (parallel)
const variations = await parallel(
  outfits,
  (outfit) => transformImage({ model: nanoBanana, image: base, prompt: outfit }),
  { maxConcurrent: 5 }
)

// Animate each (batched due to rate limits)
const animated = await batch(variations.results, animateVariation, { batchSize: 3 })
```

## Common Batch Sizes

| Operation | Batch Size | Reason |
|-----------|------------|--------|
| Image Generation | 8 | Fast API |
| Animation (Kling) | 3 | Rate limited, expensive |
| Voiceover (ElevenLabs) | 5 | API limits |
| Lipsync (Fal) | 3 | Slow processing |
| Captions | 8 | CPU-bound, fast |
| Upload | 16 | I/O bound |
