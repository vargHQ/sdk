export interface CharacterWithReference {
  name: string;
  description: string;
  basePrompt: string;
  backgroundPrompt: string;
  colorEditPrompt: string;
  motionPrompt: string;
  style: string;
  tags: string[];
}

export const SlavicAthlete: CharacterWithReference = {
  name: "SlavicAthlete",
  description:
    "A beautiful Slavic woman in athletic wear, perfect for fitness and lifestyle content",
  basePrompt: `A beautiful Slavic woman in her late 20s with platinum blonde hair, icy blue eyes, and perfect skin. She bends very close to the phone lens, her chest framed by a white sports bra with a bold neckline, and she is wearing high-waisted athletic shorts in pale grey that accentuate her figure. Her expression is confident and slightly teasing. The background shows a modern apartment with soft daylight through large windows, reinforcing the natural homemade vibe`,
  backgroundPrompt: "Remove character from the image",
  colorEditPrompt: `Change the sports bra colour to deep purple. Keep everything else exactly the same - same woman, same pose, same lighting, same background.`,
  motionPrompt: `A woman in stylish deep purple sportswear takes a selfie. She starts very close to camera showing face and decolletage, then steps back to reveal more of her body. She turns slightly to the LEFT to show her figure in profile. Warm daylight, authentic homemade video feel. Camera static.`,
  style:
    "athletic wear, modern apartment, soft daylight, authentic homemade vibe",
  tags: [
    "fitness",
    "athletic",
    "female",
    "slavic",
    "selfie",
    "lifestyle",
    "ugc",
  ],
};
