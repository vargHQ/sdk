// examples/basic.ts

import { generateImage, generateVideo, animateImage } from '@varg/sdk';
import { fal } from '@varg/fal';

async function main() {

  const higgsfieldSoul = higgsfield.image('higgsfield/soul')
  const nanoBanana = fal.image('fal-ai/nano-banana-pro')
  const klingImage2Video = fal.video('fal-ai/kling-video/v2.5-turbo/pro/image-to-video')
  const elevenLabs = elevenlabs.speech('eleven_multilingual_v2')
  const lypsync = fal.video('fal-ai/sync-lipsync/v2/pro')

  const prompts = [
    'A stunningly beautiful South Asian woman in her mid-20s with long, thick black hair and warm brown skin. She leans very close to the phone camera as if just pressing record, cleavage emphasized by a bright pink sports bra with a deep cut. Her big brown eyes and glossy lips dominate the frame, with a blurred cozy home interior behind her in soft daylight.',
    'A gorgeous Mediterranean woman in her early 30s with olive skin and striking hazel eyes. She wears a sleek dark blue sports bra with a plunging neckline, slightly bending forward toward the camera. The close-up frame captures her natural beauty and chest, creating an intimate, authentic selfie perspective. Background: rustic interior with warm golden light.',
    'A breathtaking red-haired European woman in her late 20s with freckles and wavy shoulder-length hair. She is dressed in a light green sports bra with a low neckline, leaning close to the camera, lips slightly parted. The first frame emphasizes her face and cleavage, with a sunlit wooden interior and plants softly visible behind.'
  ]

  const animationPrompt = 'A woman in stylish sportswear begins taking selfies on her phone. The first shot is a close-up of her face and décolletage, very intimate and natural, as if she has just pressed the record button. She steps back, and the camera shows more and more of her body until she appears fully in the frame, standing in the cozy, sun-filled interior of her home. She poses naturally, first looking straight at the camera, then turning slightly to the side to show her figure in profile. Her movements seem relaxed and realistic, like in a personal video shot on a phone at home. The lighting is warm daylight, and the atmosphere is authentic, confident, and slightly playful. Camera static'

  
    const { image } = await generateImage({
        model: higgsfieldSoul,
        prompt: prompts[0],
        aspectRatio: '9:16',
        providerOptions: {
            style_id: "1cb4b936-77bf-4f9a-9039-f3d349a4cdbe", // realistic
        }
    })

  console.log('Generated image:', image.mediaType);


  // Text to video with Kling
  const { video } = await animateImage({
    model: klingImage2Video,
    image,
    prompt: animationPrompt,
    duration: 5,
    providerOptions: {
        cfg_scale: 0.5,
    },
  });

  const { speech } = await generateSpeech({
    model: elevenLabs,
    text: 'I use varg.ai SDK to generate realistic videos.',
    voice: 'kPzsL2i3teMYv0FxEYQ6',
  });




}

main().catch(console.error);
