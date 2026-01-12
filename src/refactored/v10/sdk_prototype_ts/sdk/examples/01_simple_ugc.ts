/**
 * Example 1: Simple UGC Video (40% of scripts)
 *
 * Pipeline: Image → Animation → Voice → Lipsync → Captions
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

const CHARACTER = {
  prompt: `A 45-year-old woman with warm smile, casual clothes,
    cozy living room, speaking to phone camera, UGC selfie style`,
  script: `I never thought a simple change could make such a difference.
    But here I am, 20 pounds lighter and feeling amazing.`,
}

async function main() {
  const { image } = await generateImage({
    model: higgsfield.image('soul'),
    prompt: CHARACTER.prompt,
    aspectRatio: '9:16',
  })

  const { video } = await animateImage({
    model: fal.video('kling'),
    image,
    prompt: 'Woman speaking naturally to camera, friendly expression',
    duration: 10,
  })

  const { audio } = await generateSpeech({
    model: elevenlabs.speech('multilingual_v2', { voice: 'matilda' }),
    text: CHARACTER.script,
  })

  const { video: lipsynced } = await generateLipsync({
    model: fal.lipsync(),
    video,
    audio,
  })

  const { video: final } = await addCaptions({
    video: lipsynced,
    text: CHARACTER.script,
    style: { position: 'bottom', fontSize: 60, useBounce: true },
  })

  console.log(`Done: ${final.url}`)
  return final
}

main().catch(console.error)
