export interface Character {
  name: string;
  description: string;
  prompt: string;
  style: string;
  tags: string[];
}

export const BusinessCat: Character = {
  name: "BusinessCat",
  description:
    "A sophisticated tabby cat wearing a tailored business suit, perfect for comedic corporate content",
  prompt: `A sophisticated tabby cat wearing a tailored tiny business suit and small round glasses, standing upright at a McDonald's counter. One paw raised pointing assertively at the illuminated menu board above. The cat has an extremely serious, concentrated expression with furrowed brows. Cinematic lighting with warm McDonald's interior ambiance, shallow depth of field focusing on the cat's determined face, photorealistic fur texture with fine detail. Professional business atmosphere meets fast food chaos.`,
  style:
    "photorealistic, cinematic lighting, shallow depth of field, fine fur detail",
  tags: ["cat", "comedy", "corporate", "business", "meme", "photorealistic"],
};
