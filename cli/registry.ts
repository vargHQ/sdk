/**
 * varg model and action registry
 * defines all available models, actions, and their schemas
 */

export interface ModelDef {
  name: string;
  description: string;
  type: "model";
  inputType: string;
  outputType: string;
  providers: string[];
  defaultProvider: string;
  schema: {
    input: {
      type: "object";
      required: string[];
      properties: Record<
        string,
        {
          type: string;
          description: string;
          enum?: (string | number)[];
          default?: unknown;
          format?: string;
        }
      >;
    };
    output: {
      type: string;
      format?: string;
      description: string;
    };
  };
}

export interface ActionDef {
  name: string;
  description: string;
  type: "action";
  inputType: string;
  outputType: string;
  routesTo: {
    model: string;
    description: string;
    isDefault?: boolean;
    condition?: string;
  }[];
  schema: ModelDef["schema"];
}

export type RegistryItem = ModelDef | ActionDef;

export const models: Record<string, ModelDef> = {
  kling: {
    name: "kling",
    description: "kling 2.5 — video generation by kuaishou",
    type: "model",
    inputType: "text/image",
    outputType: "video",
    providers: ["fal", "replicate"],
    defaultProvider: "fal",
    schema: {
      input: {
        type: "object",
        required: ["prompt"],
        properties: {
          prompt: {
            type: "string",
            description: "what to generate",
          },
          image: {
            type: "string",
            format: "file-path",
            description: "input image (enables image-to-video mode)",
          },
          duration: {
            type: "integer",
            enum: [5, 10],
            default: 5,
            description: "video duration in seconds",
          },
          aspect: {
            type: "string",
            enum: ["16:9", "9:16", "1:1"],
            default: "16:9",
            description: "aspect ratio",
          },
          provider: {
            type: "string",
            enum: ["fal", "replicate"],
            default: "fal",
            description: "provider to use",
          },
        },
      },
      output: {
        type: "string",
        format: "file-path",
        description: "path to generated video",
      },
    },
  },

  flux: {
    name: "flux",
    description: "flux pro — high quality image generation",
    type: "model",
    inputType: "text",
    outputType: "image",
    providers: ["fal", "replicate"],
    defaultProvider: "fal",
    schema: {
      input: {
        type: "object",
        required: ["prompt"],
        properties: {
          prompt: {
            type: "string",
            description: "what to generate",
          },
          size: {
            type: "string",
            enum: [
              "square_hd",
              "square",
              "portrait_4_3",
              "portrait_16_9",
              "landscape_4_3",
              "landscape_16_9",
            ],
            default: "landscape_4_3",
            description: "image size/aspect",
          },
          provider: {
            type: "string",
            enum: ["fal", "replicate"],
            default: "fal",
            description: "provider to use",
          },
        },
      },
      output: {
        type: "string",
        format: "file-path",
        description: "path to generated image",
      },
    },
  },

  wan: {
    name: "wan",
    description: "wan 2.5 — talking head video generation",
    type: "model",
    inputType: "image + audio",
    outputType: "video",
    providers: ["fal", "replicate"],
    defaultProvider: "fal",
    schema: {
      input: {
        type: "object",
        required: ["image", "audio", "prompt"],
        properties: {
          image: {
            type: "string",
            format: "file-path",
            description: "input image (portrait photo)",
          },
          audio: {
            type: "string",
            format: "file-path",
            description: "input audio (speech)",
          },
          prompt: {
            type: "string",
            description: "motion prompt",
          },
          duration: {
            type: "string",
            enum: ["5", "10"],
            default: "5",
            description: "video duration in seconds",
          },
          resolution: {
            type: "string",
            enum: ["480p", "720p", "1080p"],
            default: "480p",
            description: "output resolution",
          },
        },
      },
      output: {
        type: "string",
        format: "file-path",
        description: "path to generated video",
      },
    },
  },

  minimax: {
    name: "minimax",
    description: "minimax video-01 — fast video generation",
    type: "model",
    inputType: "text/image",
    outputType: "video",
    providers: ["replicate"],
    defaultProvider: "replicate",
    schema: {
      input: {
        type: "object",
        required: ["prompt"],
        properties: {
          prompt: {
            type: "string",
            description: "what to generate",
          },
          image: {
            type: "string",
            format: "file-path",
            description: "first frame image (optional)",
          },
        },
      },
      output: {
        type: "string",
        format: "file-path",
        description: "path to generated video",
      },
    },
  },

  whisper: {
    name: "whisper",
    description: "openai whisper — speech to text",
    type: "model",
    inputType: "audio",
    outputType: "text",
    providers: ["groq", "fireworks", "replicate"],
    defaultProvider: "groq",
    schema: {
      input: {
        type: "object",
        required: ["audio"],
        properties: {
          audio: {
            type: "string",
            format: "file-path",
            description: "audio file to transcribe",
          },
          provider: {
            type: "string",
            enum: ["groq", "fireworks"],
            default: "groq",
            description: "provider to use",
          },
          language: {
            type: "string",
            description: "language code (optional)",
          },
        },
      },
      output: {
        type: "string",
        description: "transcribed text",
      },
    },
  },

  elevenlabs: {
    name: "elevenlabs",
    description: "elevenlabs — text to speech",
    type: "model",
    inputType: "text",
    outputType: "audio",
    providers: ["elevenlabs"],
    defaultProvider: "elevenlabs",
    schema: {
      input: {
        type: "object",
        required: ["text"],
        properties: {
          text: {
            type: "string",
            description: "text to convert to speech",
          },
          voice: {
            type: "string",
            enum: [
              "rachel",
              "domi",
              "bella",
              "antoni",
              "elli",
              "josh",
              "arnold",
              "adam",
              "sam",
            ],
            default: "rachel",
            description: "voice to use",
          },
        },
      },
      output: {
        type: "string",
        format: "file-path",
        description: "path to generated audio",
      },
    },
  },
};

export const actions: Record<string, ActionDef> = {
  "image-to-video": {
    name: "image-to-video",
    description: "animate a still image",
    type: "action",
    inputType: "image",
    outputType: "video",
    routesTo: [
      {
        model: "kling",
        description: "best quality · 5-10s",
        isDefault: true,
      },
      { model: "wan", description: "with audio · talking heads" },
      { model: "minimax", description: "fast · stylized" },
    ],
    schema: {
      input: {
        type: "object",
        required: ["image"],
        properties: {
          image: {
            type: "string",
            format: "file-path",
            description: "image to animate",
          },
          prompt: {
            type: "string",
            description: "motion description",
          },
          duration: {
            type: "integer",
            enum: [5, 10],
            default: 5,
            description: "video duration",
          },
          model: {
            type: "string",
            enum: ["kling", "wan", "minimax"],
            default: "kling",
            description: "model to use",
          },
        },
      },
      output: {
        type: "string",
        format: "file-path",
        description: "path to generated video",
      },
    },
  },

  "text-to-video": {
    name: "text-to-video",
    description: "generate video from text",
    type: "action",
    inputType: "text",
    outputType: "video",
    routesTo: [
      { model: "kling", description: "best quality", isDefault: true },
      { model: "minimax", description: "fast" },
    ],
    schema: {
      input: {
        type: "object",
        required: ["prompt"],
        properties: {
          prompt: {
            type: "string",
            description: "what to generate",
          },
          duration: {
            type: "integer",
            enum: [5, 10],
            default: 5,
            description: "video duration",
          },
          model: {
            type: "string",
            enum: ["kling", "minimax"],
            default: "kling",
            description: "model to use",
          },
        },
      },
      output: {
        type: "string",
        format: "file-path",
        description: "path to generated video",
      },
    },
  },

  "text-to-image": {
    name: "text-to-image",
    description: "generate an image from text",
    type: "action",
    inputType: "text",
    outputType: "image",
    routesTo: [{ model: "flux", description: "high quality", isDefault: true }],
    schema: {
      input: {
        type: "object",
        required: ["prompt"],
        properties: {
          prompt: {
            type: "string",
            description: "what to generate",
          },
          size: {
            type: "string",
            enum: [
              "square_hd",
              "square",
              "portrait_4_3",
              "portrait_16_9",
              "landscape_4_3",
              "landscape_16_9",
            ],
            default: "landscape_4_3",
            description: "image size",
          },
        },
      },
      output: {
        type: "string",
        format: "file-path",
        description: "path to generated image",
      },
    },
  },

  transcribe: {
    name: "transcribe",
    description: "speech to text transcription",
    type: "action",
    inputType: "audio",
    outputType: "text",
    routesTo: [
      { model: "whisper", description: "best accuracy", isDefault: true },
    ],
    schema: {
      input: {
        type: "object",
        required: ["audio"],
        properties: {
          audio: {
            type: "string",
            format: "file-path",
            description: "audio/video file to transcribe",
          },
          provider: {
            type: "string",
            enum: ["groq", "fireworks"],
            default: "groq",
            description: "provider to use",
          },
          output: {
            type: "string",
            format: "file-path",
            description: "output file path",
          },
        },
      },
      output: {
        type: "string",
        description: "transcribed text or srt",
      },
    },
  },

  voice: {
    name: "voice",
    description: "text to speech generation",
    type: "action",
    inputType: "text",
    outputType: "audio",
    routesTo: [
      {
        model: "elevenlabs",
        description: "high quality voices",
        isDefault: true,
      },
    ],
    schema: {
      input: {
        type: "object",
        required: ["text"],
        properties: {
          text: {
            type: "string",
            description: "text to speak",
          },
          voice: {
            type: "string",
            enum: [
              "rachel",
              "domi",
              "bella",
              "antoni",
              "elli",
              "josh",
              "arnold",
              "adam",
              "sam",
            ],
            default: "rachel",
            description: "voice to use",
          },
          output: {
            type: "string",
            format: "file-path",
            description: "output file path",
          },
        },
      },
      output: {
        type: "string",
        format: "file-path",
        description: "path to generated audio",
      },
    },
  },
};

// resolve a name to model or action
export function resolve(name: string): RegistryItem | null {
  // check explicit namespace
  if (name.startsWith("model/")) {
    return models[name.slice(6)] || null;
  }
  if (name.startsWith("action/")) {
    return actions[name.slice(7)] || null;
  }

  // check models first, then actions
  if (models[name]) return models[name];
  if (actions[name]) return actions[name];

  return null;
}

// fuzzy search
export function search(query: string): RegistryItem[] {
  const q = query.toLowerCase();
  const results: RegistryItem[] = [];

  for (const model of Object.values(models)) {
    if (
      model.name.toLowerCase().includes(q) ||
      model.description.toLowerCase().includes(q) ||
      model.inputType.toLowerCase().includes(q) ||
      model.outputType.toLowerCase().includes(q)
    ) {
      results.push(model);
    }
  }

  for (const action of Object.values(actions)) {
    if (
      action.name.toLowerCase().includes(q) ||
      action.description.toLowerCase().includes(q) ||
      action.inputType.toLowerCase().includes(q) ||
      action.outputType.toLowerCase().includes(q)
    ) {
      results.push(action);
    }
  }

  return results;
}

// get all items
export function list(type?: "model" | "action"): RegistryItem[] {
  const items: RegistryItem[] = [];

  if (!type || type === "model") {
    items.push(...Object.values(models));
  }
  if (!type || type === "action") {
    items.push(...Object.values(actions));
  }

  return items;
}
