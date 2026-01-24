export interface CharacterWithReference {
  name: string;
  description: string;
  basePrompt: string;
  clothingEditPrompt: string;
  patternRef: string;
  motionPrompt: string;
  style: string;
  tags: string[];
}

export const AsianInfluencer: CharacterWithReference = {
  name: "AsianInfluencer",
  description:
    "A beautiful East Asian woman for talking head videos and branded content",
  basePrompt: `A close, spontaneous iPhone selfie of a beautiful East Asian woman in her early 20s with sleek jet-black chin-length bob hair and porcelain skin. She wears a fitted black t-shirt, with dewy, natural skin textures and almond-shaped dark brown eyes filling the frame. The soft morning light filters through a minimalist Scandinavian bedroom with blurred details, including simple, natural wood furniture and neutral textiles. Her calm, inviting expression appears relaxed and looking at camera, with a casual, slightly off-center framing emphasizing genuine intimacy. The image embodies authentic iPhone lighting and texture, capturing an intimate, natural moment with understated elegance.`,
  clothingEditPrompt: `Same woman, same pose, same lighting. Her black tank t-shirt now has a stylish geometric pattern printed on it. Keep everything else identical - face, hair, expression, background.`,
  patternRef: "https://s3.varg.ai/uploads/images/varg-pattern_631fa5f2.png",
  motionPrompt:
    "woman speaking naturally, subtle head movements, friendly expression, looking at camera",
  style:
    "iPhone selfie, Scandinavian bedroom, soft morning light, authentic intimate",
  tags: [
    "influencer",
    "asian",
    "female",
    "talking-head",
    "selfie",
    "branded-content",
  ],
};
