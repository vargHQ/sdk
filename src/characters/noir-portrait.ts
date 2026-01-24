export interface CharacterWithReference {
  name: string;
  description: string;
  imageRefs: string[];
  characterDescription: string;
  prompt: string;
  motionPrompt: string;
  style: string;
  tags: string[];
}

export const NoirPortrait: CharacterWithReference = {
  name: "NoirPortrait",
  description:
    "A young woman with short dark bob, dramatic orange rim lighting, noir aesthetic",
  imageRefs: [
    "https://s3.varg.ai/uploads/images/1_0475e227.png",
    "https://s3.varg.ai/uploads/images/xyearp51qvve-zi3nrcve-zbno2hfgt5gergjrof_995f553d.png",
  ],
  characterDescription:
    "young woman, short dark brown bob with wispy bangs, oval face, fair skin, large dark brown eyes, full lips, silver hoop earrings",
  prompt: `Using the attached reference images, generate a photorealistic Three-quarter editorial portrait of the exact same character — maintain identical face, hairstyle, and proportions from Image 1.

Framing: Head and shoulders, cropped at upper chest. Direct eye contact with camera.

Natural confident expression, relaxed shoulders.
Preserve the outfit neckline and visible clothing details from reference.

Background: Deep black with two contrasting orange gradient accents matching Reference 2. Soft gradient bleed, no hard edges.

Shot on 85mm f/1.4 lens, shallow depth of field. Clean studio lighting — soft key light on face, subtle rim light on hair and shoulders for separation. High-end fashion editorial aesthetic.`,
  motionPrompt:
    "She steps back, camera reveals more of her body until she appears fully in frame. Studio lighting, authentic confident slightly playful atmosphere. Camera static. She poses naturally, first looking straight at camera, then turning slightly to the side to show her figure in profile. Intense orange lighting.",
  style:
    "noir aesthetic, dramatic orange rim lighting, deep black background, editorial fashion",
  tags: [
    "noir",
    "editorial",
    "female",
    "dramatic-lighting",
    "fashion",
    "portrait",
  ],
};
