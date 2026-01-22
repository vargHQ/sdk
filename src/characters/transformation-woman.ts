export interface Character {
  name: string;
  description: string;
  beforePrompt: string;
  afterPrompt: string;
  beforeMotion: string;
  afterMotion: string;
  style: string;
  tags: string[];
}

export const TransformationWoman: Character = {
  name: "TransformationWoman",
  description:
    "A woman character for before/after transformation videos, perfect for fitness and lifestyle content",
  beforePrompt: `ultra realistic photo of woman in her 30s, brown hair, green eyes, overweight, puffy face, double chin, tired expression, wearing loose grey t-shirt, bathroom mirror selfie, iPhone photo quality, soft unflattering lighting, no makeup, messy hair in bun, slightly sad eyes, authentic candid look, photorealistic, 8k`,
  afterPrompt: `ultra realistic photo of woman in her 30s, brown hair, green eyes, fit slim, defined jawline, glowing skin, confident radiant smile, wearing fitted black tank top, bathroom mirror selfie, iPhone photo quality, good lighting, light natural makeup, hair down and styled, bright happy eyes, authentic proud look, same woman as before but 40 pounds lighter, photorealistic, 8k`,
  beforeMotion: `woman looks down sadly, sighs, then looks at camera with tired expression, subtle breathing, authentic movement`,
  afterMotion: `woman smiles confidently, touches hair, looks at camera proudly, slight head tilt, happy subtle movement`,
  style: "ultra realistic, iPhone photo quality, bathroom mirror selfie, 8k",
  tags: [
    "transformation",
    "fitness",
    "ugc",
    "before-after",
    "weight-loss",
    "female",
    "realistic",
  ],
};
