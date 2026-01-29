export interface CharacterWithReference {
  name: string;
  description: string;
  imageRef: string;
  patternRef: string;
  basePrompt: string;
  outfit: string;
  location: string;
  poses: Array<{
    name: string;
    prompt: string;
    motion: string;
  }>;
  style: string;
  tags: string[];
}

export const ElegantWoman: CharacterWithReference = {
  name: "ElegantWoman",
  description:
    "A sophisticated woman in elegant dress with multiple pose variations, perfect for fashion and lifestyle content",
  imageRef:
    "https://s3.varg.ai/uploads/images/tlhzlrio6janrkhrwd29h-qp3ofcnoqv0-m4z6gr_280fee62.png",
  patternRef: "https://s3.varg.ai/uploads/images/varg-pattern.png",
  basePrompt:
    "Same girl from reference, consistent face and body proportions, same hairstyle, same posture.",
  outfit:
    "elegant black dress with bold graphic pattern from reference — fitted silhouette, off-shoulder neckline, knee-length, subtle sheen. Pattern integrated seamlessly into fabric",
  location:
    "Elegant apartment with full-length mirror, warm ambient lighting, minimalist modern decor, soft evening glow through sheer curtains, neutral tones",
  poses: [
    {
      name: "front",
      prompt:
        "Mirror selfie, phone held up, confident poised pose, weight on one hip, full body visible in mirror reflection",
      motion:
        "Takes mirror selfie, shifts weight gracefully. Smooths dress with free hand. Tilts head finding best angle. Soft smile, taps phone. Confident elegant energy.",
    },
    {
      name: "earring",
      prompt:
        "Standing close to mirror, one hand adjusting earring, other holding phone, soft smile, chin slightly lifted, full body in reflection, elegant posture",
      motion:
        "Standing close to mirror, adjusts earring. Touches hair, fixes strand behind ear. Lifts chin, takes pic. Checks phone, satisfied nod.",
    },
    {
      name: "side",
      prompt:
        "Standing at three-quarter angle to mirror, looking over shoulder at phone, shows elegant silhouette and dress drape with pattern visible, confident smile, hand on hip",
      motion:
        "Turns to show side profile. Hand on hip, elongates posture. Looks over shoulder at mirror. Playful confident smile. Snaps pic.",
    },
    {
      name: "back",
      prompt:
        "Full back-view studio shot with perfect consistency of body proportions, hairstyle, and posture, identical fabric texture, same material, same pattern placement, looking over shoulder at phone with classy expression, one foot slightly forward",
      motion:
        "Shows back to mirror, looks over shoulder elegantly. Slight sway, shows off dress back detail. Classy expression, subtle smile. Takes pic. Happy with result.",
    },
  ],
  style:
    "fashion editorial, mirror selfie, elegant apartment, warm ambient lighting",
  tags: [
    "fashion",
    "elegant",
    "female",
    "lifestyle",
    "mirror-selfie",
    "multiple-poses",
  ],
};
