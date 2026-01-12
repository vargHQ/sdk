/**
 * Example 2: Batch 15 Characters Campaign (25% of scripts)
 *
 * The "apostle diet" / "menopause campaign" pattern:
 * - 15 diverse characters
 * - Parallel image generation
 * - Batched animation (3 at a time)
 * - Batched voiceover (5 at a time)
 * - Batched lipsync (3 at a time)
 * - Save results to JSON
 *
 * Based on: apostle_diet_15_creatives.py, menopause_15_videos_batch_parallel.py
 */

import {
  fal,
  higgsfield,
  elevenlabs,
  generateImage,
  animateImage,
  generateSpeech,
  generateLipsync,
  batch,
  BATCH_SIZES,
  type Character,
} from '../index'

// Character definitions (typical campaign has 15 characters)
const CHARACTERS: Character[] = [
  {
    id: 1,
    name: 'White Christian Mom',
    prompt: 'A 42-year-old white woman, curvy, hair in bun, cross necklace, warm home kitchen, speaking to camera, realistic',
    voice: 'matilda',
    script: 'First week on this diet, my cravings just stopped. I lost 6 pounds without even trying.',
    voiceSettings: { stability: 0.6, style: 0.2 },
  },
  {
    id: 2,
    name: 'Young Pastor Daughter',
    prompt: 'A 21-year-old slim white woman, long blonde hair, holding Bible, church interior, speaking to camera, realistic',
    voice: 'freya',
    script: 'I thought it was just a trend, but Biblical eating made me feel spiritually grounded.',
    voiceSettings: { stability: 0.5, style: 0.3 },
  },
  {
    id: 3,
    name: 'Blue-collar Dad',
    prompt: 'A 38-year-old white man, stocky build, work clothes, garage background, speaking to camera, realistic',
    voice: 'callum',
    script: 'Lost 12 pounds just by eating early and cutting out junk. Simple food changed everything.',
    voiceSettings: { stability: 0.7, style: 0.1 },
  },
  {
    id: 4,
    name: 'Southern Grandma',
    prompt: 'A 55-year-old larger white woman, gray curly hair, floral apron, cozy kitchen, speaking to camera, realistic',
    voice: 'dorothy',
    script: "I've tried every diet since the 90s. Only this one made my body feel clean again.",
    voiceSettings: { stability: 0.65, style: 0.2 },
  },
  {
    id: 5,
    name: 'Midwest Nurse',
    prompt: 'A 33-year-old white woman, hair in bun, blue scrubs, hospital background blurred, speaking to camera, realistic',
    voice: 'rachel',
    script: 'This diet gave me energy during 12-hour shifts. No crashes, no sugar addiction.',
    voiceSettings: { stability: 0.6, style: 0.2 },
  },
  // ... in real script there would be 15 characters
]

async function generateCampaign() {
  console.log('=' .repeat(60))
  console.log('BATCH CAMPAIGN: 15 Characters')
  console.log('=' .repeat(60))

  const imageModel = higgsfield.image('soul', { style: 'realistic' })
  const videoModel = fal.video('kling')
  const lipsyncModel = fal.lipsync()

  // Phase 1: Generate all images (batch of 8)
  console.log('\n📸 Phase 1: Generating images...')
  const images = await batch(
    CHARACTERS,
    async (char) => {
      const { image } = await generateImage({
        model: imageModel,
        prompt: char.prompt,
        aspectRatio: '9:16',
      })
      return { id: char.id, image }
    },
    {
      batchSize: BATCH_SIZES.imageGeneration, // 8
      delayBetweenBatches: 1000,
      onProgress: (done, total) => console.log(`  ${done}/${total} images`),
    }
  )
  console.log(`✓ Generated ${images.successful} images`)

  // Phase 2: Animate images (batch of 3 - Kling rate limit)
  console.log('\n🎬 Phase 2: Animating videos...')
  const videos = await batch(
    images.results,
    async ({ id, image }) => {
      const { video } = await animateImage({
        model: videoModel,
        image,
        prompt: 'Person speaking naturally to camera, subtle movements',
        duration: 10,
        providerOptions: { cfgScale: 0.5 },
      })
      return { id, video }
    },
    {
      batchSize: BATCH_SIZES.animation, // 3
      delayBetweenBatches: 5000,
      onProgress: (done, total) => console.log(`  ${done}/${total} videos`),
    }
  )
  console.log(`✓ Animated ${videos.successful} videos`)

  // Phase 3: Generate voiceovers (batch of 5 - ElevenLabs limit)
  console.log('\n🎙️ Phase 3: Generating voiceovers...')
  const voices = await batch(
    CHARACTERS,
    async (char) => {
      const voiceModel = elevenlabs.speech('multilingual_v2', {
        voice: char.voice,
        ...char.voiceSettings,
      })
      const { audio } = await generateSpeech({
        model: voiceModel,
        text: char.script,
      })
      return { id: char.id, audio }
    },
    {
      batchSize: BATCH_SIZES.voiceover, // 5
      delayBetweenBatches: 2000,
      onProgress: (done, total) => console.log(`  ${done}/${total} voices`),
    }
  )
  console.log(`✓ Generated ${voices.successful} voiceovers`)

  // Phase 4: Apply lipsync (batch of 3)
  console.log('\n👄 Phase 4: Applying lipsync...')
  const lipsyncInputs = videos.results.map((v) => ({
    ...v,
    audio: voices.results.find((a) => a.id === v.id)?.audio,
  }))

  const finals = await batch(
    lipsyncInputs.filter((i) => i.audio),
    async ({ id, video, audio }) => {
      const { video: final } = await generateLipsync({
        model: lipsyncModel,
        video,
        audio: audio!,
      })
      return { id, video: final }
    },
    {
      batchSize: BATCH_SIZES.lipsync, // 3
      delayBetweenBatches: 5000,
      onProgress: (done, total) => console.log(`  ${done}/${total} lipsynced`),
    }
  )
  console.log(`✓ Lipsynced ${finals.successful} videos`)

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('CAMPAIGN COMPLETE')
  console.log('='.repeat(60))
  console.log(`Total: ${finals.successful}/${CHARACTERS.length} videos`)

  // Save results (in real script: JSON file)
  const results = finals.results.map((f) => {
    const char = CHARACTERS.find((c) => c.id === f.id)!
    return {
      id: f.id,
      name: char.name,
      videoUrl: f.video.url,
      status: 'completed',
    }
  })

  console.log('\nResults:')
  results.forEach((r) => console.log(`  ${r.id}. ${r.name}: ${r.videoUrl}`))

  return results
}

generateCampaign().catch(console.error)
