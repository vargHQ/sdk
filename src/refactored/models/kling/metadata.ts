export const metadata = {
  name: "kling",
  description: "Kling 2.5 — high-quality video generation by Kuaishou",
  category: "video-generation",
  capabilities: ["text-to-video", "image-to-video"],
  providers: ["fal", "replicate"],
  pricing: {
    fal: { per_second: 0.0064 }, // ~$0.032 for 5s
    replicate: { per_second: 0.008 }, // ~$0.04 for 5s
  },
  limits: {
    duration: { min: 5, max: 10 },
    max_prompt_length: 500,
  },
  examples: [
    {
      prompt: "a cat riding a skateboard in tokyo",
      duration: "5",
    },
    {
      image: "./photo.png",
      prompt: "person starts dancing",
      duration: "10",
    },
  ],
};
