/**
 * Example 4: Hook + Body + Packshot Assembly (18% of scripts)
 *
 * Ad creative structure:
 * - Hook (5s) - attention grabber, animated character action
 * - Body (10-15s) - main content with lipsync + captions
 * - B-roll (5-6s) - product/food footage with text overlays
 * - Packshot (4-5s) - CTA with blurred background + button
 *
 * Based on: apostle_diet_v2_with_voice.py, assemble_apostle_creatives.py
 */

import {
  fal,
  higgsfield,
  elevenlabs,
  generateImage,
  animateImage,
  generateSpeech,
  generateLipsync,
  addCaptions,
  addTitle,
  createPackshot,
  concatVideos,
  type VideoObject,
} from '../index'

interface Creative {
  id: number
  name: string
  // Character
  characterPrompt: string
  hookAction: string  // e.g., "touching cross necklace with relief"
  // Content
  script: string
  voice: string
  // Packshot
  packshotTitle: string
  packshotButton: string
}

const CREATIVE: Creative = {
  id: 1,
  name: 'Christian Mom Transformation',

  characterPrompt: `A 42-year-old white Christian woman, curvy body,
    hair in neat bun, small cross necklace visible,
    warm home interior, kind eyes, speaking to camera,
    realistic UGC style photography`,

  hookAction: 'touching her cross necklace with emotional relief, tears of joy',

  script: `First week on the Apostle Diet, my cravings just stopped.
    I felt lighter, calmer, and dropped 6 pounds without even trying.
    This is what Biblical eating does for you.`,

  voice: 'matilda',

  packshotTitle: 'Start Your Apostle Journey',
  packshotButton: 'GET THE MEAL PLAN',
}

// B-roll config
const BROLL_URL = 'https://s3.varg.ai/broll/fish_cooking.mp4'
const BROLL_TEXTS = [
  '12 Biblical Foods',
  '40 Days → 22 lbs Lost',
  'No calorie counting',
]

async function createAdCreative() {
  console.log('=' .repeat(60))
  console.log('AD CREATIVE ASSEMBLY')
  console.log(`Creative: ${CREATIVE.name}`)
  console.log('Structure: Hook (5s) → Body (15s) → B-roll (6s) → Packshot (5s)')
  console.log('=' .repeat(60))

  const imageModel = higgsfield.image('soul', { style: 'realistic' })
  const videoModel = fal.video('kling')
  const voiceModel = elevenlabs.speech('multilingual_v2', { voice: CREATIVE.voice })
  const lipsyncModel = fal.lipsync()

  // =========================================================================
  // Step 1: Generate character image
  // =========================================================================
  console.log('\n📸 Step 1: Generating character...')
  const { image: characterImage } = await generateImage({
    model: imageModel,
    prompt: CREATIVE.characterPrompt,
    aspectRatio: '9:16',
  })
  console.log(`✓ Character image: ${characterImage.url}`)

  // =========================================================================
  // Step 2: Generate HOOK video (5s animated action)
  // =========================================================================
  console.log('\n🎬 Step 2: Generating hook video (5s)...')
  const { video: hookVideo } = await animateImage({
    model: videoModel,
    image: characterImage,
    prompt: `Person ${CREATIVE.hookAction}, looking at camera with emotion, cinematic`,
    duration: 5,
    providerOptions: { cfgScale: 0.5 },
  })
  console.log(`✓ Hook video: ${hookVideo.url}`)

  // =========================================================================
  // Step 3: Generate BODY video (talking head with lipsync)
  // =========================================================================
  console.log('\n🎬 Step 3: Generating body video...')

  // 3a: Animate for talking
  const { video: talkingVideo } = await animateImage({
    model: videoModel,
    image: characterImage,
    prompt: 'Person speaking naturally to camera, friendly expression, subtle movements',
    duration: 15,
    providerOptions: { cfgScale: 0.5 },
  })

  // 3b: Generate voiceover
  console.log('  Generating voiceover...')
  const { audio: voiceover } = await generateSpeech({
    model: voiceModel,
    text: CREATIVE.script,
    providerOptions: { stability: 0.6, style: 0.2 },
  })

  // 3c: Apply lipsync
  console.log('  Applying lipsync...')
  const { video: lipsyncedVideo } = await generateLipsync({
    model: lipsyncModel,
    video: talkingVideo,
    audio: voiceover,
    providerOptions: { syncMode: 'cut_off' },
  })

  // 3d: Add captions
  console.log('  Adding captions...')
  const { video: bodyVideo } = await addCaptions({
    video: lipsyncedVideo,
    text: CREATIVE.script,
    style: {
      position: 'bottom',
      fontSize: 60,
      useBounce: true,
    },
  })
  console.log(`✓ Body video: ${bodyVideo.url}`)

  // =========================================================================
  // Step 4: Prepare B-ROLL with text overlays
  // =========================================================================
  console.log('\n🎥 Step 4: Preparing b-roll...')
  let brollVideo: VideoObject = { url: BROLL_URL, mediaType: 'video', duration: 6 }

  // Add text overlays sequentially
  for (const text of BROLL_TEXTS) {
    const { video: withText } = await addTitle({
      video: brollVideo,
      title: text,
      position: 'center',
      style: { fontSize: 48, color: 'white', animation: 'fade-in' },
    })
    brollVideo = withText
  }
  console.log(`✓ B-roll with overlays: ${brollVideo.url}`)

  // =========================================================================
  // Step 5: Generate PACKSHOT
  // =========================================================================
  console.log('\n🎯 Step 5: Creating packshot...')
  const { video: packshotVideo } = await createPackshot({
    config: {
      backgroundImage: characterImage,
      title: CREATIVE.packshotTitle,
      buttonText: CREATIVE.packshotButton,
      buttonColor: '#FF4444',
      blurIntensity: 25,
    },
    duration: 5,
  })
  console.log(`✓ Packshot: ${packshotVideo.url}`)

  // =========================================================================
  // Step 6: FINAL ASSEMBLY
  // =========================================================================
  console.log('\n🔗 Step 6: Assembling final creative...')
  const { video: finalCreative } = await concatVideos({
    videos: [hookVideo, bodyVideo, brollVideo, packshotVideo],
    transition: 'crossfade',
    transitionDuration: 0.3,
  })

  console.log('\n' + '='.repeat(60))
  console.log('CREATIVE COMPLETE')
  console.log('='.repeat(60))
  console.log(`\nFinal video: ${finalCreative.url}`)
  console.log(`Duration: ~${5 + 15 + 6 + 5}s`)
  console.log('\nStructure:')
  console.log('  0:00-0:05 - Hook (emotional action)')
  console.log('  0:05-0:20 - Body (testimonial with captions)')
  console.log('  0:20-0:26 - B-roll (product benefits)')
  console.log('  0:26-0:31 - Packshot (CTA)')

  return finalCreative
}

createAdCreative().catch(console.error)
