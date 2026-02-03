/**
 * Launch Video #7: UGC Weight Loss Transformation
 *
 * Ultra realistic AI UGC ad - split screen before/after with voiceover and captions.
 * Left: overweight person (Higgsfield), Right: slim fit person (nano-banana-pro/edit)
 *
 * Run: bunx vargai render launch-videos/07-ugc-weight-loss.tsx
 *
 * Note: Requires GROQ_API_KEY for auto-captions transcription
 */
import { elevenlabs, fal, higgsfield } from "vargai/ai";
import {
  Captions,
  Clip,
  Image,
  Music,
  Render,
  Speech,
  Split,
  Title,
  Video,
} from "vargai/react";

// === VOICEOVER SCRIPT ===
const VOICEOVER_SCRIPT =
  "With this technique I lost 40 pounds in just 3 months!";

// === VOICE SETTINGS ===
// Using turbo model for faster generation, and a more energetic voice
const VOICE_ID = "aMSt68OGf4xUZAnLpTU8"; // energetic female voice
const VOICE_MODEL = elevenlabs.speechModel("eleven_multilingual_v2");

// === CHARACTER DEFINITION ===
const CHARACTER_DESCRIPTION = "woman in her 30s, brown hair, green eyes";
const BEFORE_BODY = "overweight, puffy face, double chin, tired expression";
const AFTER_BODY =
  "fit slim, defined jawline, glowing skin, confident radiant smile";

// === SCENE SETTINGS ===
const SCENE_SETTING = "bathroom mirror selfie, iPhone photo quality";
const BEFORE_LIGHTING =
  "soft unflattering lighting, no makeup, messy hair in bun";
const AFTER_LIGHTING =
  "good lighting, light natural makeup, hair down and styled";

// === PROMPTS ===
const BEFORE_PROMPT = `ultra realistic photo of ${CHARACTER_DESCRIPTION}, ${BEFORE_BODY}, wearing loose grey t-shirt, ${SCENE_SETTING}, ${BEFORE_LIGHTING}, slightly sad eyes, authentic candid look, photorealistic, 8k`;

const AFTER_PROMPT = `ultra realistic photo of ${CHARACTER_DESCRIPTION}, ${AFTER_BODY}, wearing fitted black tank top, ${SCENE_SETTING}, ${AFTER_LIGHTING}, bright happy eyes, authentic proud look, same woman as before but 40 pounds lighter, photorealistic, 8k`;

// === MOTION DESCRIPTIONS ===
const BEFORE_MOTION =
  "woman looks down sadly, sighs, then looks at camera with tired expression, subtle breathing, authentic movement";
const AFTER_MOTION =
  "woman smiles confidently, touches hair, looks at camera proudly, slight head tilt, happy subtle movement";

// === IMAGES ===
// Before image - generated with Higgsfield Soul (realistic style)
const beforeImage = Image({
  prompt: BEFORE_PROMPT,
  model: higgsfield.imageModel("soul", {
    styleId: higgsfield.styles.REALISTIC,
  }),
  aspectRatio: "9:16",
});

// After image - generated with nano-banana-pro/edit using before as reference
const afterImage = Image({
  prompt: { text: AFTER_PROMPT, images: [beforeImage] },
  model: fal.imageModel("nano-banana-pro/edit"),
  aspectRatio: "9:16",
});

// === VIDEOS ===
// Before video - sad/tired movement
const beforeVideo = Video({
  prompt: { text: BEFORE_MOTION, images: [beforeImage] },
  model: fal.videoModel("kling-v2.5"),
  duration: 5,
});

// After video - confident/happy movement
const afterVideo = Video({
  prompt: { text: AFTER_MOTION, images: [afterImage] },
  model: fal.videoModel("kling-v2.5"),
  duration: 5,
});

// === VOICEOVER ===
const voiceover = Speech({
  model: VOICE_MODEL,
  voice: VOICE_ID,
  children: VOICEOVER_SCRIPT,
});

// === MUSIC ===
const MUSIC_PROMPT =
  "upbeat motivational pop, inspiring transformation music, energetic but not overwhelming, modern fitness vibe";
const _MUSIC_DURATION = 15;
const _MUSIC_VOLUME = 0.15; // Low volume so voiceover is clear

// === CAPTIONS SETTINGS ===
const CAPTIONS_STYLE = "tiktok";
const CAPTIONS_COLOR = "#ffffff";

// === TITLE TEXT ===
const TITLE_TEXT = "My 3-Month Transformation";

export default (
  <Render width={1080 * 2} height={1920}>
    {/* Background music (low volume) */}
    <Music prompt={MUSIC_PROMPT} model={elevenlabs.musicModel()} />

    {/* Main clip with split screen */}
    <Clip duration={5}>
      {/* Split layout - before on left, after on right */}
      <Split direction="horizontal">{[beforeVideo, afterVideo]}</Split>

      {/* Title at top */}
      <Title position="top" color="#ffffff">
        {TITLE_TEXT}
      </Title>
    </Clip>

    {/* TikTok-style captions with voiceover */}
    <Captions src={voiceover} style={CAPTIONS_STYLE} color={CAPTIONS_COLOR} />
  </Render>
);
