/**
 * Example 3: Post-Production Batch (10% of scripts)
 *
 * Take existing videos and apply:
 * - Captions
 * - Aspect ratio conversion (9:16 → 4:5, 1:1)
 * - Voiceover
 * - Music
 *
 * Based on: add_captions_to_all.py, convert_to_4_5_with_blur.py, batch_video_postproduction.py
 */

import {
  addCaptions,
  addVoiceover,
  addMusic,
  convertAspectRatio,
  batch,
  type VideoObject,
  type AspectRatio,
} from '../index'

// Input: existing videos (e.g., from previous generation or external source)
const INPUT_VIDEOS: Array<{ id: number; url: string; script: string }> = [
  {
    id: 1,
    url: 'https://s3.varg.ai/videos/char_01.mp4',
    script: 'I lost 20 pounds in just 30 days following this simple plan.',
  },
  {
    id: 2,
    url: 'https://s3.varg.ai/videos/char_02.mp4',
    script: 'My energy levels are through the roof. I feel like a new person.',
  },
  {
    id: 3,
    url: 'https://s3.varg.ai/videos/char_03.mp4',
    script: 'The best part? I never felt hungry. This diet just works.',
  },
  {
    id: 4,
    url: 'https://s3.varg.ai/videos/char_04.mp4',
    script: 'My doctor was amazed at my transformation. All in just 6 weeks.',
  },
  {
    id: 5,
    url: 'https://s3.varg.ai/videos/char_05.mp4',
    script: 'I wish I had found this sooner. It changed my life completely.',
  },
]

const VOICEOVER_URL = 'https://s3.varg.ai/audio/campaign_voiceover.mp3'
const MUSIC_URL = 'https://s3.varg.ai/audio/background_music.mp3'
const OUTPUT_RATIOS: AspectRatio[] = ['9:16', '4:5', '1:1']

async function postProductionBatch() {
  console.log('=' .repeat(60))
  console.log('POST-PRODUCTION BATCH')
  console.log(`Videos: ${INPUT_VIDEOS.length}`)
  console.log(`Output formats: ${OUTPUT_RATIOS.join(', ')}`)
  console.log('=' .repeat(60))

  // Step 1: Add captions to all videos
  console.log('\n📝 Step 1: Adding captions...')
  const captioned = await batch(
    INPUT_VIDEOS,
    async (item) => {
      const { video } = await addCaptions({
        video: item.url,
        text: item.script,
        style: {
          position: 'lower-middle',
          fontSize: 55,
          activeColor: 'white',
          inactiveColor: '#FFE135',
          useBounce: true,
          bounceScale: 1.15,
        },
      })
      return { id: item.id, video }
    },
    {
      batchSize: 5,
      onProgress: (done, total) => console.log(`  Captions: ${done}/${total}`),
    }
  )
  console.log(`✓ Added captions to ${captioned.successful} videos`)

  // Step 2: Add voiceover (optional - if shared voiceover)
  console.log('\n🎙️ Step 2: Adding voiceover...')
  const withVoice = await batch(
    captioned.results,
    async ({ id, video }) => {
      const { video: voiced } = await addVoiceover({
        video,
        audio: VOICEOVER_URL,
        mixMode: 'overlay',
        volume: 0.8,
      })
      return { id, video: voiced }
    },
    {
      batchSize: 5,
      onProgress: (done, total) => console.log(`  Voiceover: ${done}/${total}`),
    }
  )
  console.log(`✓ Added voiceover to ${withVoice.successful} videos`)

  // Step 3: Add background music
  console.log('\n🎵 Step 3: Adding music...')
  const withMusic = await batch(
    withVoice.results,
    async ({ id, video }) => {
      const { video: musical } = await addMusic({
        video,
        music: MUSIC_URL,
        volume: 0.2,
        fadeIn: 1,
        fadeOut: 2,
      })
      return { id, video: musical }
    },
    {
      batchSize: 5,
      onProgress: (done, total) => console.log(`  Music: ${done}/${total}`),
    }
  )
  console.log(`✓ Added music to ${withMusic.successful} videos`)

  // Step 4: Convert to multiple aspect ratios
  console.log('\n📐 Step 4: Converting aspect ratios...')
  const allVariants: Array<{ id: number; ratio: AspectRatio; url: string }> = []

  for (const { id, video } of withMusic.results) {
    // Original is 9:16, add it
    allVariants.push({ id, ratio: '9:16', url: video.url })

    // Convert to other ratios
    for (const ratio of OUTPUT_RATIOS.filter((r) => r !== '9:16')) {
      const { video: converted } = await convertAspectRatio({
        video,
        targetRatio: ratio,
        method: 'blur-background',
        blurIntensity: 20,
      })
      allVariants.push({ id, ratio, url: converted.url })
    }
    console.log(`  Video ${id}: converted to ${OUTPUT_RATIOS.length} formats`)
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('POST-PRODUCTION COMPLETE')
  console.log('='.repeat(60))

  // Group by video ID
  const grouped = INPUT_VIDEOS.map((input) => ({
    id: input.id,
    variants: allVariants
      .filter((v) => v.id === input.id)
      .reduce((acc, v) => ({ ...acc, [v.ratio]: v.url }), {} as Record<AspectRatio, string>),
  }))

  console.log('\nOutput:')
  grouped.forEach((g) => {
    console.log(`\nVideo ${g.id}:`)
    Object.entries(g.variants).forEach(([ratio, url]) => {
      console.log(`  ${ratio}: ${url}`)
    })
  })

  return grouped
}

postProductionBatch().catch(console.error)
