export async function createTalkingCharacter(options: TalkingCharacterOptions) {
    const { characterPrompt, script, voice = 'rachel', outputFormat = 'tiktok' } = options;
    // 1. generate character headshot
    console.log('[1/6] generating character...');
    const { image } = await generateImage({
      model: fal.image('flux-pro'),
      prompt: `professional headshot, ${characterPrompt}, studio lighting, neutral background`,
      size: '1:1',
    });
    // 2. generate voiceover
    console.log('[2/6] generating voiceover...');
    const { audio: voiceover } = await generateVoice({
      model: elevenlabs.tts('eleven_multilingual_v2'),
      text: script,
      voice,
    });
    // 3. animate character (image-to-video)
    console.log('[3/6] animating character...');
    const { video: animated } = await generateVideo({
      model: fal.video('kling-v2.5'),
      prompt: 'person talking naturally, subtle head movements, professional demeanor',
      image: image.url,
      duration: 5,
    });
    // 4. lipsync
    console.log('[4/6] adding lipsync...');
    const { video: lipsynced } = await sync({
      model: fal.sync('lipsync-v2'),
      video: animated.url,
      audio: voiceover.url,
    });
    // 5. transcribe + caption
    console.log('[5/6] adding captions...');
    const { segments } = await transcribe({
      model: fal.transcription('whisper-large-v3'),
      audio: voiceover.url,
    });
    const { video: captioned } = await caption({
      model: ffmpeg.caption(),
      video: lipsynced.url,
      segments,
      style: 'tiktok', // animated word-by-word
    });
    // 6. format for social
    console.log('[6/6] preparing for social media...');
    const { video: final } = await transform({
      model: ffmpeg.transform(),
      video: captioned.url,
      format: outputFormat,  // handles aspect ratio, duration limits, etc
    });
    return {
      headshot: image.url,
      voiceover: voiceover.url,
      animated: animated.url,
      lipsynced: lipsynced.url,
      captioned: captioned.url,
      final: final.url,
    };
  }
  // usage
  const result = await createTalkingCharacter({
    characterPrompt: 'friendly female tech founder in her 30s',
    script: 'hey everyone! today i want to share three tips that completely changed how i work...',
    voice: 'rachel',
    outputFormat: 'tiktok',
  });
  console.log('done!', result.final);