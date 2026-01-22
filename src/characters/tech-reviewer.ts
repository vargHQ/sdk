export interface Character {
  name: string;
  description: string;
  prompt: string;
  motionPrompt: string;
  style: string;
  tags: string[];
}

export const TechReviewer: Character = {
  name: "TechReviewer",
  description:
    "A friendly tech reviewer with glasses, perfect for product demos and talking head videos",
  prompt: `friendly tech reviewer, young man with glasses, studio lighting, professional headshot, clean background, approachable expression, modern casual style, high quality portrait`,
  motionPrompt: `talking naturally, slight head movements, friendly expression, occasional hand gestures, engaging with camera`,
  style: "professional headshot, studio lighting, clean background",
  tags: [
    "tech",
    "reviewer",
    "talking-head",
    "professional",
    "product-demo",
    "male",
  ],
};
