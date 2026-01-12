/**
 * Example 1: Simple UGC Video (40% of scripts)
 *
 * The most common pattern:
 * Image → Animation → Voice → Lipsync
 *
 * Based on: generate_menopause_campaign.py, create_pastor_diet_video.py
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
} from '../index'

async function createSimpleUGC() {
  // 1. Define models
  const soul = higgsfield.image('soul', { style: 'realistic' })
  const kling = fal.video('kling')
  const voice = elevenlabs.speech('multilingual_v2', { voice: 'matilda' })
  const lipsync = fal.lipsync()

  // 2. Character definition
  const character = {
    prompt: `A 45-year-old woman with warm smile, casual home clothes,
             cozy living room background, speaking to phone camera,
             natural lighting, realistic UGC selfie style`,
    script: `I never thought a simple change could make such a difference.
             But here I am, 20 pounds lighter and feeling amazing.
             This diet just works.`,
  }

  console.log('🎨 Generating character image...')
  const { image } = await generateImage({
    model: soul,
    prompt: character.prompt,
    aspectRatio: '9:16',
    providerOptions: {
      style_id: '1cb4b936-77bf-4f9a-9039-f3d349a4cdbe',
    },
  })

  console.log('🎬 Animating character...')
  const { video } = await animateImage({
    model: kling,
    image,
    prompt: 'Woman speaking naturally to camera, gentle head movements, friendly expression',
    duration: 10,
    providerOptions: { cfgScale: 0.5 },
  })

  console.log('🎙️ Generating voiceover...')
  const { audio } = await generateSpeech({
    model: voice,
    text: character.script,
    providerOptions: { stability: 0.6, style: 0.2 },
  })

  console.log('👄 Applying lipsync...')
  const { video: lipsynced } = await generateLipsync({
    model: lipsync,
    video,
    audio,
    providerOptions: { syncMode: 'cut_off' },
  })

  console.log('📝 Adding captions...')
  const { video: final } = await addCaptions({
    video: lipsynced,
    text: character.script,
    style: {
      position: 'bottom',
      fontSize: 60,
      activeColor: 'white',
      inactiveColor: '#FFE135',
      useBounce: true,
    },
  })

  console.log('✅ Done!')
  console.log(`Final video: ${final.url}`)

  return final
}

createSimpleUGC().catch(console.error)
