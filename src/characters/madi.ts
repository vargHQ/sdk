export interface CharacterWithReference {
  name: string;
  description: string;
  imageRef: string;
  scenes: Array<{
    prompt: string;
    motion: string;
  }>;
  style: string;
  tags: string[];
}

export const Madi: CharacterWithReference = {
  name: "Madi",
  description:
    "A expressive woman character with multiple scene variations, perfect for TikTok-style content",
  imageRef:
    "https://s3.varg.ai/fellowers/madi/character_shots/madi_shot_03_closeup.png",
  scenes: [
    {
      prompt:
        "extreme close-up face shot, surprised expression with wide eyes, looking directly at camera, holding peach near lips",
      motion:
        "eyes widen in surprise, eyebrows raise slightly, subtle head tilt forward. Static shot, no camera movement.",
    },
    {
      prompt:
        "45-degree angle medium shot showing face and hands, biting into peach with exaggerated enjoyment, juice on lips, playful expression",
      motion:
        "turns head 45 degrees, bites into peach, juice drips down chin, hands move expressively. Slow push-in camera movement.",
    },
    {
      prompt:
        "low angle shot from below, looking down at camera with confident smirk, holding peach triumphantly, dramatic perspective",
      motion:
        "looks down at camera with growing smile, raises peach slightly, confident head tilt. Static camera, slight lens distortion.",
    },
    {
      prompt:
        "high angle shot from above, looking up at camera with playful smile, arms spread wide, peach in one hand, endearing expression",
      motion:
        "looks up at camera, expression shifts from neutral to excited smile, subtle wink, slight forward lean. Gentle camera tilt down.",
    },
  ],
  style: "TikTok-style, multiple angles, expressive emotions, close-up shots",
  tags: [
    "tiktok",
    "expressive",
    "female",
    "multiple-scenes",
    "close-up",
    "emotional",
  ],
};
