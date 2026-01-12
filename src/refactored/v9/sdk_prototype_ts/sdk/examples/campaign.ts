/**
 * Campaign Example - Full pipeline based on 272 script analysis
 *
 * This demonstrates the complete workflow:
 * 1. Generate character images (parallel)
 * 2. Animate to videos (batched, 3 at a time)
 * 3. Generate voiceovers (batched, 5 at a time)
 * 4. Apply lipsync (batched, 3 at a time)
 * 5. Add captions
 * 6. Convert to multiple aspect ratios
 * 7. Add packshot
 * 8. Final assembly
 */

import {
  // Providers
  fal,
  higgsfield,
  elevenlabs,

  // Generation
  generateImage,
  animateImage,
  generateSpeech,
  generateLipsync,

  // Post-processing
  addCaptions,
  convertToMultipleRatios,
  createPackshot,
  concatVideos,

  // Batch processing
  batch,
  BATCH_SIZES,

  // Types
  type Character,
  type CharacterResult,
  type AspectRatio,
} from '../index'

// =============================================================================
// Campaign Configuration
// =============================================================================

const CAMPAIGN_CONFIG = {
  name: 'Fitness Transformation 2024',
  aspectRatios: ['9:16', '4:5'] as AspectRatio[],
  videoDuration: 10 as const,
  s3Folder: 'campaigns/fitness-2024',
}

const CHARACTERS: Character[] = [
  {
    id: 1,
    name: 'Morning Runner',
    prompt:
      'A 45-year-old woman in running clothes, energetic smile, ' +
      'sunrise park background, speaking to phone camera, ' +
      'natural UGC style, realistic photography',
    voice: 'matilda',
    script:
      'I started running at 45 and it changed my life. ' +
      "30 pounds down and I've never felt more alive.",
    voiceSettings: { stability: 0.6, style: 0.2 },
  },
  {
    id: 2,
    name: 'Gym Dad',
    prompt:
      'A 38-year-old man in gym clothes, proud expression, ' +
      'home gym background with weights, speaking to camera, ' +
      'natural lighting, realistic photo',
    voice: 'callum',
    script:
      'My kids inspired me to get in shape. ' +
      'Now I can keep up with them and then some.',
    voiceSettings: { stability: 0.7, style: 0.1 },
  },
  {
    id: 3,
    name: 'Yoga Grandma',
    prompt:
      'A 62-year-old woman with silver hair in yoga pose, ' +
      'peaceful expression, serene studio background, ' +
      'speaking to camera, realistic style',
    voice: 'dorothy',
    script:
      'Age is just a number. I started yoga at 60 ' +
      "and it's the best decision I ever made.",
    voiceSettings: { stability: 0.65, style: 0.2 },
  },
  {
    id: 4,
    name: 'Tennis Mom',
    prompt:
      'A 52-year-old athletic woman in tennis outfit, ' +
      'confident smile, tennis court background, ' +
      'speaking to phone camera, natural daylight',
    voice: 'alice',
    script:
      'At 52, I can outrun women half my age. ' +
      'This diet gave me back my energy.',
    voiceSettings: { stability: 0.6, style: 0.15 },
  },
  {
    id: 5,
    name: 'Swimming Senior',
    prompt:
      'A 65-year-old man near a pool, fit for his age, ' +
      'warm smile, morning light, speaking to camera, ' +
      'realistic UGC style',
    voice: 'james',
    script:
      'My doctor said I had the heart of a 40-year-old. ' +
      "All because I changed how I eat.",
    voiceSettings: { stability: 0.7, style: 0.1 },
  },
]

// =============================================================================
// Campaign Generator
// =============================================================================

async function generateCampaign() {
  console.log('='.repeat(60))
  console.log(`Campaign: ${CAMPAIGN_CONFIG.name}`)
  console.log(`Characters: ${CHARACTERS.length}`)
  console.log(`Aspect Ratios: ${CAMPAIGN_CONFIG.aspectRatios.join(', ')}`)
  console.log('='.repeat(60))

  // Models
  const imageModel = higgsfield.image('soul', { style: 'realistic' })
  const videoModel = fal.video('kling')
  const lipsyncModel = fal.lipsync()

  const results: CharacterResult[] = []

  // ==========================================================================
  // Phase 1: Generate Images (parallel, batch of 8)
  // ==========================================================================

  console.log('\n📸 Phase 1: Generating character images...')

  const imageResults = await batch(
    CHARACTERS,
    async (char) => {
      const { image } = await generateImage({
        model: imageModel,
        prompt: char.prompt,
        aspectRatio: '9:16',
      })
      return { characterId: char.id, image }
    },
    {
      batchSize: BATCH_SIZES.imageGeneration,
      delayBetweenBatches: 1000,
      onProgress: (done, total) => console.log(`  Images: ${done}/${total}`),
    }
  )

  console.log(`  ✓ Generated ${imageResults.successful} images`)

  // ==========================================================================
  // Phase 2: Animate Images (batch of 3, rate limited)
  // ==========================================================================

  console.log('\n🎬 Phase 2: Animating characters...')

  const videoResults = await batch(
    imageResults.results,
    async ({ characterId, image }) => {
      const { video } = await animateImage({
        model: videoModel,
        image,
        prompt: 'Person speaking naturally to camera, subtle movements, friendly',
        duration: CAMPAIGN_CONFIG.videoDuration,
        providerOptions: { cfgScale: 0.5 },
      })
      return { characterId, video }
    },
    {
      batchSize: BATCH_SIZES.animation,
      delayBetweenBatches: 5000,
      onProgress: (done, total) => console.log(`  Videos: ${done}/${total}`),
    }
  )

  console.log(`  ✓ Animated ${videoResults.successful} videos`)

  // ==========================================================================
  // Phase 3: Generate Voiceovers (batch of 5)
  // ==========================================================================

  console.log('\n🎙️ Phase 3: Generating voiceovers...')

  const voiceResults = await batch(
    CHARACTERS,
    async (char) => {
      const voiceModel = elevenlabs.speech('multilingual_v2', {
        voice: char.voice,
        stability: char.voiceSettings?.stability,
        style: char.voiceSettings?.style,
      })

      const { audio } = await generateSpeech({
        model: voiceModel,
        text: char.script,
      })
      return { characterId: char.id, audio }
    },
    {
      batchSize: BATCH_SIZES.voiceover,
      delayBetweenBatches: 2000,
      onProgress: (done, total) => console.log(`  Voices: ${done}/${total}`),
    }
  )

  console.log(`  ✓ Generated ${voiceResults.successful} voiceovers`)

  // ==========================================================================
  // Phase 4: Apply Lipsync (batch of 3)
  // ==========================================================================

  console.log('\n👄 Phase 4: Applying lipsync...')

  // Combine video and audio results
  const lipsyncInputs = videoResults.results.map((v) => {
    const voice = voiceResults.results.find((a) => a.characterId === v.characterId)
    return { characterId: v.characterId, video: v.video, audio: voice?.audio }
  })

  const lipsyncResults = await batch(
    lipsyncInputs.filter((i) => i.audio),
    async ({ characterId, video, audio }) => {
      const { video: lipsyncVideo } = await generateLipsync({
        model: lipsyncModel,
        video,
        audio: audio!,
        providerOptions: { syncMode: 'cut_off' },
      })
      return { characterId, video: lipsyncVideo }
    },
    {
      batchSize: BATCH_SIZES.lipsync,
      delayBetweenBatches: 5000,
      onProgress: (done, total) => console.log(`  Lipsync: ${done}/${total}`),
    }
  )

  console.log(`  ✓ Applied lipsync to ${lipsyncResults.successful} videos`)

  // ==========================================================================
  // Phase 5: Add Captions (batch of 8)
  // ==========================================================================

  console.log('\n📝 Phase 5: Adding captions...')

  const captionResults = await batch(
    lipsyncResults.results,
    async ({ characterId, video }) => {
      const char = CHARACTERS.find((c) => c.id === characterId)!

      const { video: captioned } = await addCaptions({
        video,
        text: char.script,
        style: {
          position: 'bottom',
          fontSize: 60,
          activeColor: 'white',
          inactiveColor: '#FFE135',
          useBounce: true,
        },
      })
      return { characterId, video: captioned }
    },
    {
      batchSize: BATCH_SIZES.caption,
      onProgress: (done, total) => console.log(`  Captions: ${done}/${total}`),
    }
  )

  console.log(`  ✓ Added captions to ${captionResults.successful} videos`)

  // ==========================================================================
  // Phase 6: Convert Aspect Ratios
  // ==========================================================================

  console.log('\n📐 Phase 6: Converting aspect ratios...')

  for (const { characterId, video } of captionResults.results) {
    const variants = await convertToMultipleRatios({
      video,
      ratios: CAMPAIGN_CONFIG.aspectRatios.filter((r) => r !== '9:16'),
      method: 'blur-background',
    })

    const char = CHARACTERS.find((c) => c.id === characterId)!
    results.push({
      characterId,
      characterName: char.name,
      status: 'completed',
      finalUrls: {
        '9:16': video.url,
        ...Object.fromEntries(
          Object.entries(variants).map(([ratio, result]) => [ratio, result.video.url])
        ),
      } as Record<AspectRatio, string>,
    })
  }

  console.log(`  ✓ Converted to ${CAMPAIGN_CONFIG.aspectRatios.length} aspect ratios`)

  // ==========================================================================
  // Summary
  // ==========================================================================

  console.log('\n' + '='.repeat(60))
  console.log('CAMPAIGN COMPLETE')
  console.log('='.repeat(60))

  const successful = results.filter((r) => r.status === 'completed')
  console.log(`\n✓ Completed: ${successful.length}/${CHARACTERS.length}`)

  for (const result of successful) {
    console.log(`\n${result.characterId}. ${result.characterName}`)
    for (const [ratio, url] of Object.entries(result.finalUrls || {})) {
      console.log(`   ${ratio}: ${url}`)
    }
  }

  return results
}

// =============================================================================
// Run
// =============================================================================

generateCampaign().catch(console.error)
