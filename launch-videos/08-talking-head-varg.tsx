/**
 * Launch Video #8: Talking Head - varg Promo with Lipsync
 *
 * A beautiful character says "with varg you can create anything at scale"
 * Uses Higgsfield Soul for character, nano-banana-pro/edit for branded clothing,
 * Animate for image-to-video, and Video with sync-v2 for lip synchronization
 *
 * Run: bunx vargai render launch-videos/08-talking-head-varg.tsx
 */
import { elevenlabs, fal, higgsfield } from "vargai/ai";
import {
  Captions,
  Clip,
  Image,
  Music,
  Render,
  Speech,
  Video,
} from "vargai/react";

// === VOICEOVER SCRIPT ===
const VOICEOVER_SCRIPT =
  "With varg, you can create any videos anything at scale!";

// === VOICE SETTINGS ===
const VOICE_ID = "5l5f8iK3YPeGga21rQIX"; // friendly female voice

// === CHARACTER PROMPT ===
const CHARACTER_BASE_PROMPT = `A close, spontaneous iPhone selfie of a beautiful East Asian woman in her early 20s with sleek jet-black chin-length bob hair and porcelain skin. She wears a fitted black t-shirt, with dewy, natural skin textures and almond-shaped dark brown eyes filling the frame. The soft morning light filters through a minimalist Scandinavian bedroom with blurred details, including simple, natural wood furniture and neutral textiles. Her calm, inviting expression appears relaxed and looking at camera, with a casual, slightly off-center framing emphasizing genuine intimacy. The image embodies authentic iPhone lighting and texture, capturing an intimate, natural moment with understated elegance.`;

// === CLOTHING MODIFICATION PROMPT ===
const CLOTHING_EDIT_PROMPT = `Same woman, same pose, same lighting. Her black tank t-shirt now has a stylish geometric pattern printed on it. Keep everything else identical - face, hair, expression, background.`;

// === VARG PATTERN REFERENCE ===
const VARG_PATTERN_URL =
  "https://s3.varg.ai/uploads/images/varg-pattern_631fa5f2.png";

// === MOTION PROMPT ===
const MOTION_PROMPT =
  "woman speaking naturally, subtle head movements, friendly expression, looking at camera";

// === IMAGES ===
// Base character - generated with Higgsfield Soul (realistic style)
const baseCharacter = Image({
  prompt: CHARACTER_BASE_PROMPT,
  model: higgsfield.imageModel("soul", {
    styleId: higgsfield.styles.REALISTIC,
  }),
  aspectRatio: "9:16",
});

// Character with varg pattern on clothing
const brandedCharacter = Image({
  prompt: {
    text: CLOTHING_EDIT_PROMPT,
    images: [baseCharacter, VARG_PATTERN_URL],
  },
  model: fal.imageModel("nano-banana-pro/edit"),
  aspectRatio: "9:16",
});

// === ANIMATED CHARACTER (image-to-video) ===
const animatedCharacter = Video({
  prompt: {
    text: MOTION_PROMPT,
    images: [brandedCharacter],
  },
  model: fal.videoModel("kling-v2.5"),
});

// === VOICEOVER ===
const voiceover = Speech({
  model: elevenlabs.speechModel("eleven_v3"),
  voice: VOICE_ID,
  children: VOICEOVER_SCRIPT,
});

// === MUSIC ===
const MUSIC_PROMPT =
  "modern tech ambient, subtle electronic, confident corporate vibe, minimal and clean";
const MUSIC_VOLUME = 0.1;

export default (
  <Render width={1080} height={1920}>
    {/* Subtle background music */}
    <Music
      prompt={MUSIC_PROMPT}
      model={elevenlabs.musicModel()}
      volume={MUSIC_VOLUME}
    />

    {/* Main talking head clip with lipsync */}
    <Clip duration={5}>
      {/* Lipsync: animated video + speech audio -> sync-v2 */}
      <Video
        prompt={{
          video: animatedCharacter,
          audio: voiceover,
        }}
        model={fal.videoModel("sync-v2-pro")}
      />
    </Clip>

    {/* TikTok-style captions */}
    <Captions src={voiceover} style="tiktok" color="#ffffff" />
  </Render>
);
