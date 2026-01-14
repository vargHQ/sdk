# varg ts-sdk migration plan

## core

- [ ] File (load from path, url, buffer)
- [ ] File.toTemp() - save to temp file for editly integration
- [ ] scene`` tagged template for composing elements in prompts
- [ ] types (AspectRatio, Element, etc)

## providers

- [ ] @varg/fal (kling, nano-banana, lipsync)
- [ ] @varg/elevenlabs (tts, music)
- [ ] @varg/higgsfield (soul, characters)
- [ ] @varg/heygen (talking heads)
- [ ] @varg/openai (sora, gpt-image, dall-e)
- [ ] @varg/replicate (birefnet, generic models)

## generation

- [ ] generateImage (text to image)
- [ ] generateImage (image to image / edit)
- [ ] generateVideo (text to video)
- [ ] generateVideo (image to video)
- [ ] generateSpeech (voiceover via elevenlabs)
- [ ] generateMusic (music generation via elevenlabs)
- [ ] generateLipsync (sync video to audio via fal)
- [ ] generateTalkingHead (photo to talking video via heygen)
- [ ] generateElement (character/item/style reference for consistent generation)

## editing (use editly directly)

users use editly npm package directly for video composition.
we provide `File.toTemp()` to bridge ai outputs → editly paths.

editly covers these py-sdk features:
- [ ] crop_to_aspect_ratio → editly clips with resizeMode
- [ ] mix_audio_with_ducking → editly audioNorm + audioTracks
- [ ] apply_zoom_effect → editly zoomDirection on layers
- [ ] create_ken_burns_effect → editly zoomDirection: "in" | "out"
- [ ] create_slideshow → editly clips[] with transitions
- [ ] concatenate_videos → editly clips[] with transitions
- [ ] picture_in_picture → editly layers with position/size
- [ ] blur_background_resize → editly resizeMode: "contain-blur"
- [ ] 67 gl-transitions (fade, crossfade, wipe, cube, etc.)

## custom effects (not in editly)

- [ ] addCaptions (tiktok-style word-by-word) - custom fabric.js layer for editly
- [ ] createSlider (before/after reveal animation)
- [ ] createPushTransition (card push effect)
- [ ] createSwipeAnimation (tinder-style card swipes)
- [ ] createSplitScreen (side-by-side comparison)
- [ ] createPackshot (end card with cta button + blinking cta)

## image processing

- [ ] removeBackground (via replicate birefnet)

## notes

- editly used directly (not wrapped)
- File.toTemp() bridges ai outputs to editly string paths
- providers are separate packages (@varg/fal, @varg/elevenlabs, etc)
- generateElement returns { images, text } for use in prompts
- scene`` template composes elements in prompts
