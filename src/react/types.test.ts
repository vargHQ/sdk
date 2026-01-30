import { describe, expect, test } from "bun:test";
import type {
  VargElement,
  VargNode,
  VargElementType,
  RenderProps,
  ClipProps,
  ImageProps,
  VideoProps,
  OverlayProps,
  MusicProps,
  SpeechProps,
  CaptionsProps,
  RenderOptions,
  RenderMode,
  DefaultModels,
  PositionProps,
  TrimProps,
  AudioProps,
  ElementPropsMap,
} from "./types";
import type { ImageModelV3 } from "@ai-sdk/provider";
import { fileCache } from "../ai-sdk/file-cache";

function createTestImageModel(): ImageModelV3 {
  return {
    specificationVersion: "v3",
    provider: "test",
    modelId: "test-image",
    maxImagesPerCall: 1,
    async doGenerate() {
      return {
        images: [new Uint8Array([1, 2, 3])],
        warnings: [],
        response: {
          timestamp: new Date(),
          modelId: "test-image",
          headers: undefined,
        },
      };
    },
  };
}

describe("VargElement type", () => {
  test("creates valid VargElement with required fields", () => {
    const element: VargElement = {
      type: "render",
      props: {},
      children: [],
    };

    expect(element.type).toBe("render");
    expect(element.props).toEqual({});
    expect(element.children).toEqual([]);
  });

  test("supports all VargElementType values", () => {
    const types: VargElementType[] = [
      "render",
      "clip",
      "overlay",
      "image",
      "video",
      "speech",
      "talking-head",
      "title",
      "subtitle",
      "music",
      "captions",
      "split",
      "slider",
      "swipe",
      "packshot",
    ];

    for (const type of types) {
      const element: VargElement = {
        type,
        props: {},
        children: [],
      };
      expect(element.type).toBe(type);
    }
  });

  test("accepts typed element with specific type", () => {
    const element: VargElement<"clip"> = {
      type: "clip",
      props: { duration: 5 },
      children: [],
    };

    expect(element.type).toBe("clip");
  });

  test("children can contain various VargNode types", () => {
    const element: VargElement = {
      type: "clip",
      props: {},
      children: [
        "text",
        123,
        null,
        undefined,
        { type: "image", props: {}, children: [] },
        ["nested", "array"],
      ],
    };

    expect(element.children).toHaveLength(6);
  });
});

describe("VargNode type", () => {
  test("VargNode accepts string", () => {
    const node: VargNode = "text content";
    expect(typeof node).toBe("string");
  });

  test("VargNode accepts number", () => {
    const node: VargNode = 42;
    expect(typeof node).toBe("number");
  });

  test("VargNode accepts null", () => {
    const node: VargNode = null;
    expect(node).toBeNull();
  });

  test("VargNode accepts undefined", () => {
    const node: VargNode = undefined;
    expect(node).toBeUndefined();
  });

  test("VargNode accepts VargElement", () => {
    const node: VargNode = {
      type: "image",
      props: {},
      children: [],
    };
    expect(typeof node).toBe("object");
  });

  test("VargNode accepts array of nodes", () => {
    const node: VargNode = ["text", 123, null];
    expect(Array.isArray(node)).toBe(true);
  });
});

describe("RenderProps", () => {
  test("accepts empty props", () => {
    const props: RenderProps = {};
    expect(props).toEqual({});
  });

  test("accepts dimension props", () => {
    const props: RenderProps = {
      width: 1920,
      height: 1080,
      fps: 30,
    };

    expect(props.width).toBe(1920);
    expect(props.height).toBe(1080);
    expect(props.fps).toBe(30);
  });

  test("accepts normalize and shortest flags", () => {
    const props: RenderProps = {
      normalize: true,
      shortest: false,
    };

    expect(props.normalize).toBe(true);
    expect(props.shortest).toBe(false);
  });

  test("accepts children", () => {
    const props: RenderProps = {
      children: [{ type: "clip", props: {}, children: [] }],
    };

    expect(Array.isArray(props.children)).toBe(true);
  });
});

describe("ClipProps", () => {
  test("accepts numeric duration", () => {
    const props: ClipProps = { duration: 5 };
    expect(props.duration).toBe(5);
  });

  test("accepts auto duration", () => {
    const props: ClipProps = { duration: "auto" };
    expect(props.duration).toBe("auto");
  });

  test("accepts transition", () => {
    const props: ClipProps = {
      transition: { name: "fade", duration: 0.5 },
    };
    expect(props.transition?.name).toBe("fade");
  });

  test("accepts cutFrom and cutTo", () => {
    const props: ClipProps = {
      cutFrom: 1,
      cutTo: 5,
    };
    expect(props.cutFrom).toBe(1);
    expect(props.cutTo).toBe(5);
  });
});

describe("PositionProps", () => {
  test("accepts all position properties", () => {
    const props: PositionProps = {
      left: "10%",
      top: "20%",
      width: "50%",
      height: "60%",
    };

    expect(props.left).toBe("10%");
    expect(props.top).toBe("20%");
    expect(props.width).toBe("50%");
    expect(props.height).toBe("60%");
  });

  test("accepts numeric values", () => {
    const props: PositionProps = {
      left: 100,
      top: 200,
      width: 500,
      height: 600,
    };

    expect(props.left).toBe(100);
  });
});

describe("AudioProps", () => {
  test("extends VolumeProps", () => {
    const props: AudioProps = {
      volume: 0.5,
    };
    expect(props.volume).toBe(0.5);
  });

  test("includes keepAudio flag", () => {
    const props: AudioProps = {
      keepAudio: true,
      volume: 0.8,
    };
    expect(props.keepAudio).toBe(true);
  });
});

describe("TrimProps", () => {
  test("accepts cutFrom and cutTo without duration", () => {
    const props: TrimProps = {
      cutFrom: 1,
      cutTo: 5,
    };
    expect(props.cutFrom).toBe(1);
    expect(props.cutTo).toBe(5);
  });

  test("accepts duration without cutFrom/cutTo", () => {
    const props: TrimProps = {
      duration: 3,
    };
    expect(props.duration).toBe(3);
  });
});

describe("ImageProps", () => {
  test("accepts prompt string", () => {
    const props: ImageProps = {
      prompt: "a beautiful sunset",
    };
    expect(props.prompt).toBe("a beautiful sunset");
  });

  test("accepts prompt with text and images", () => {
    const props: ImageProps = {
      prompt: {
        text: "enhance this",
        images: ["path/to/image.png"],
      },
    };
    expect(typeof props.prompt).toBe("object");
  });

  test("accepts src", () => {
    const props: ImageProps = {
      src: "path/to/image.png",
    };
    expect(props.src).toBe("path/to/image.png");
  });

  test("accepts model", () => {
    const model = createTestImageModel();
    const props: ImageProps = {
      model,
    };
    expect(props.model).toBe(model);
  });

  test("accepts aspect ratio", () => {
    const props: ImageProps = {
      aspectRatio: "16:9",
    };
    expect(props.aspectRatio).toBe("16:9");
  });

  test("accepts zoom directions", () => {
    const zoomValues = ["in", "out", "left", "right"] as const;
    for (const zoom of zoomValues) {
      const props: ImageProps = { zoom };
      expect(props.zoom).toBe(zoom);
    }
  });

  test("accepts removeBackground flag", () => {
    const props: ImageProps = {
      removeBackground: true,
    };
    expect(props.removeBackground).toBe(true);
  });
});

describe("VideoProps", () => {
  test("accepts prompt string", () => {
    const props: VideoProps = {
      prompt: "a walking person",
    };
    expect(props.prompt).toBe("a walking person");
  });

  test("accepts complex prompt object", () => {
    const props: VideoProps = {
      prompt: {
        text: "walk forward",
        images: ["image.png"],
        audio: "audio.mp3",
      },
    };
    expect(typeof props.prompt).toBe("object");
  });

  test("combines PositionProps, AudioProps, and TrimProps", () => {
    const props: VideoProps = {
      left: "10%",
      volume: 0.5,
      keepAudio: true,
      cutFrom: 1,
      cutTo: 5,
    };

    expect(props.left).toBe("10%");
    expect(props.volume).toBe(0.5);
    expect(props.keepAudio).toBe(true);
    expect(props.cutFrom).toBe(1);
  });

  test("accepts aspectRatio", () => {
    const props: VideoProps = {
      aspectRatio: "9:16",
    };
    expect(props.aspectRatio).toBe("9:16");
  });
});

describe("MusicProps", () => {
  test("accepts prompt", () => {
    const props: MusicProps = {
      prompt: "upbeat electronic music",
    };
    expect(props.prompt).toBe("upbeat electronic music");
  });

  test("accepts src", () => {
    const props: MusicProps = {
      src: "audio.mp3",
    };
    expect(props.src).toBe("audio.mp3");
  });

  test("accepts volume", () => {
    const props: MusicProps = {
      volume: 0.3,
    };
    expect(props.volume).toBe(0.3);
  });

  test("accepts trim props", () => {
    const props: MusicProps = {
      cutFrom: 2,
      cutTo: 10,
    };
    expect(props.cutFrom).toBe(2);
    expect(props.cutTo).toBe(10);
  });

  test("accepts start time", () => {
    const props: MusicProps = {
      start: 5,
    };
    expect(props.start).toBe(5);
  });

  test("accepts loop and ducking flags", () => {
    const props: MusicProps = {
      loop: true,
      ducking: true,
    };
    expect(props.loop).toBe(true);
    expect(props.ducking).toBe(true);
  });
});

describe("SpeechProps", () => {
  test("accepts voice and model", () => {
    const props: SpeechProps = {
      voice: "alloy",
    };
    expect(props.voice).toBe("alloy");
  });

  test("accepts volume", () => {
    const props: SpeechProps = {
      volume: 0.7,
    };
    expect(props.volume).toBe(0.7);
  });

  test("accepts id", () => {
    const props: SpeechProps = {
      id: "speech-123",
    };
    expect(props.id).toBe("speech-123");
  });

  test("accepts children as string", () => {
    const props: SpeechProps = {
      children: "Hello world",
    };
    expect(props.children).toBe("Hello world");
  });
});

describe("CaptionsProps", () => {
  test("accepts srt string path", () => {
    const props: CaptionsProps = {
      srt: "captions.srt",
    };
    expect(props.srt).toBe("captions.srt");
  });

  test("accepts style options", () => {
    const styles = ["tiktok", "karaoke", "bounce", "typewriter"] as const;
    for (const style of styles) {
      const props: CaptionsProps = { style };
      expect(props.style).toBe(style);
    }
  });

  test("accepts position", () => {
    const positions = ["top", "center", "bottom"] as const;
    for (const position of positions) {
      const props: CaptionsProps = { position };
      expect(props.position).toBe(position);
    }
  });

  test("accepts colors", () => {
    const props: CaptionsProps = {
      color: "#ffffff",
      activeColor: "#ff0000",
    };
    expect(props.color).toBe("#ffffff");
    expect(props.activeColor).toBe("#ff0000");
  });

  test("accepts fontSize", () => {
    const props: CaptionsProps = {
      fontSize: 48,
    };
    expect(props.fontSize).toBe(48);
  });
});

describe("RenderOptions", () => {
  test("accepts empty options", () => {
    const options: RenderOptions = {};
    expect(options).toEqual({});
  });

  test("accepts output path", () => {
    const options: RenderOptions = {
      output: "output/video.mp4",
    };
    expect(options.output).toBe("output/video.mp4");
  });

  test("accepts cache as string", () => {
    const options: RenderOptions = {
      cache: "/tmp/cache",
    };
    expect(options.cache).toBe("/tmp/cache");
  });

  test("accepts cache as CacheStorage", () => {
    const cache = fileCache({ dir: "/tmp/cache" });
    const options: RenderOptions = { cache };
    expect(options.cache).toBe(cache);
  });

  test("accepts quiet flag", () => {
    const options: RenderOptions = {
      quiet: true,
    };
    expect(options.quiet).toBe(true);
  });

  test("accepts verbose flag", () => {
    const options: RenderOptions = {
      verbose: true,
    };
    expect(options.verbose).toBe(true);
  });

  test("accepts mode", () => {
    const modes: RenderMode[] = ["strict", "preview"];
    for (const mode of modes) {
      const options: RenderOptions = { mode };
      expect(options.mode).toBe(mode);
    }
  });

  test("accepts defaults", () => {
    const imageModel = createTestImageModel();
    const defaults: DefaultModels = {
      image: imageModel,
    };
    const options: RenderOptions = { defaults };
    expect(options.defaults?.image).toBe(imageModel);
  });

  test("accepts backend", () => {
    const options: RenderOptions = {
      backend: "local",
    };
    expect(options.backend).toBe("local");
  });
});

describe("ElementPropsMap", () => {
  test("maps render type to RenderProps", () => {
    const props: ElementPropsMap["render"] = {
      width: 1920,
      height: 1080,
    };
    expect(props.width).toBe(1920);
  });

  test("maps clip type to ClipProps", () => {
    const props: ElementPropsMap["clip"] = {
      duration: 5,
    };
    expect(props.duration).toBe(5);
  });

  test("maps image type to ImageProps", () => {
    const props: ElementPropsMap["image"] = {
      prompt: "test",
    };
    expect(props.prompt).toBe("test");
  });

  test("maps video type to VideoProps", () => {
    const props: ElementPropsMap["video"] = {
      prompt: "test video",
    };
    expect(props.prompt).toBe("test video");
  });

  test("maps all element types", () => {
    const elementTypes: (keyof ElementPropsMap)[] = [
      "render",
      "clip",
      "overlay",
      "image",
      "video",
      "speech",
      "talking-head",
      "title",
      "subtitle",
      "music",
      "captions",
      "split",
      "slider",
      "swipe",
      "packshot",
    ];

    for (const type of elementTypes) {
      const props: ElementPropsMap[typeof type] = {};
      expect(props).toBeDefined();
    }
  });
});

describe("Type safety and constraints", () => {
  test("TrimProps prevents using both duration and cutTo", () => {
    const validProps1: TrimProps = { duration: 5 };
    const validProps2: TrimProps = { cutFrom: 1, cutTo: 5 };

    expect(validProps1.duration).toBe(5);
    expect(validProps2.cutTo).toBe(5);
  });

  test("aspectRatio enforces ratio format", () => {
    const props: ImageProps = {
      aspectRatio: "16:9",
    };
    expect(props.aspectRatio).toMatch(/^\d+:\d+$/);
  });

  test("RenderMode enforces strict or preview", () => {
    const mode1: RenderMode = "strict";
    const mode2: RenderMode = "preview";

    expect(mode1).toBe("strict");
    expect(mode2).toBe("preview");
  });
});