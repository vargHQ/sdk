import type { DataContent, ImageModel } from "ai";
import { generateImage } from "ai";

export type ElementType = "character" | "location" | "item";

export interface Element {
  type: ElementType;
  text: string;
  images: Uint8Array[];
}

export interface PromptWithElements {
  text: string;
  images: Uint8Array[];
}

export function scene(
  strings: TemplateStringsArray,
  ...elements: Element[]
): PromptWithElements {
  let text = "";
  const images: Uint8Array[] = [];
  let imageIndex = 1;

  for (let i = 0; i < strings.length; i++) {
    text += strings[i];
    if (i < elements.length) {
      const el = elements[i]!;
      const count = el.images.length;

      if (count === 1) {
        text += `[image ${imageIndex}: ${el.type} - ${el.text}]`;
      } else if (count > 1) {
        text += `[images ${imageIndex}-${imageIndex + count - 1}: ${el.type} - ${el.text}]`;
      } else {
        text += `[${el.type}: ${el.text}]`;
      }

      images.push(...el.images);
      imageIndex += count;
    }
  }

  return { text: text.trim(), images };
}

export type GenerateElementPrompt =
  | string
  | {
      text: string;
      images?: Array<DataContent>;
    };

export interface GenerateElementOptions {
  model: ImageModel;
  type: ElementType;
  prompt: GenerateElementPrompt;
  n?: number;
  size?: `${number}x${number}`;
  aspectRatio?: `${number}:${number}`;
  seed?: number;
}

export interface GenerateElementResult {
  element: Element;
}

export async function generateElement(
  options: GenerateElementOptions,
): Promise<GenerateElementResult> {
  const { model, type, prompt, n = 1, size, aspectRatio, seed } = options;

  const text = typeof prompt === "string" ? prompt : prompt.text;
  const images = typeof prompt === "string" ? undefined : prompt.images;

  const { images: generatedImages } = await generateImage({
    model,
    prompt: images ? { text, images } : text,
    n,
    size,
    aspectRatio,
    seed,
  });

  return {
    element: {
      type,
      text,
      images: generatedImages.map((img) => img.uint8Array),
    },
  };
}
