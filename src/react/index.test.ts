import { describe, expect, test } from "bun:test";
import * as reactIndex from "./index";

describe("react/index.ts exports", () => {
  test("exports all element functions", () => {
    expect(reactIndex.Captions).toBeDefined();
    expect(reactIndex.Clip).toBeDefined();
    expect(reactIndex.Image).toBeDefined();
    expect(reactIndex.Music).toBeDefined();
    expect(reactIndex.Overlay).toBeDefined();
    expect(reactIndex.Packshot).toBeDefined();
    expect(reactIndex.Render).toBeDefined();
    expect(reactIndex.Slider).toBeDefined();
    expect(reactIndex.Speech).toBeDefined();
    expect(reactIndex.Split).toBeDefined();
    expect(reactIndex.Subtitle).toBeDefined();
    expect(reactIndex.Swipe).toBeDefined();
    expect(reactIndex.TalkingHead).toBeDefined();
    expect(reactIndex.Title).toBeDefined();
    expect(reactIndex.Video).toBeDefined();
  });

  test("exports layout functions", () => {
    expect(reactIndex.Grid).toBeDefined();
    expect(reactIndex.Slot).toBeDefined();
    expect(reactIndex.SplitLayout).toBeDefined();
  });

  test("exports render functions", () => {
    expect(reactIndex.render).toBeDefined();
    expect(reactIndex.renderStream).toBeDefined();
    expect(typeof reactIndex.render).toBe("function");
    expect(typeof reactIndex.renderStream).toBe("function");
  });

  test("exports assets", () => {
    expect(reactIndex.assets).toBeDefined();
    expect(typeof reactIndex.assets).toBe("object");
  });

  test("all element functions are callable", () => {
    const renderElement = reactIndex.Render({ children: [] });
    expect(renderElement).toBeDefined();
    expect(renderElement.type).toBe("render");

    const clipElement = reactIndex.Clip({ duration: 3 });
    expect(clipElement).toBeDefined();
    expect(clipElement.type).toBe("clip");

    const imageElement = reactIndex.Image({ src: "test.png" });
    expect(imageElement).toBeDefined();
    expect(imageElement.type).toBe("image");
  });

  test("exported functions return correct element types", () => {
    const elements = [
      { fn: reactIndex.Captions, type: "captions" },
      { fn: reactIndex.Clip, type: "clip" },
      { fn: reactIndex.Image, type: "image" },
      { fn: reactIndex.Music, type: "music" },
      { fn: reactIndex.Overlay, type: "overlay" },
      { fn: reactIndex.Packshot, type: "packshot" },
      { fn: reactIndex.Render, type: "render" },
      { fn: reactIndex.Slider, type: "slider" },
      { fn: reactIndex.Speech, type: "speech" },
      { fn: reactIndex.Split, type: "split" },
      { fn: reactIndex.Subtitle, type: "subtitle" },
      { fn: reactIndex.Swipe, type: "swipe" },
      { fn: reactIndex.TalkingHead, type: "talking-head" },
      { fn: reactIndex.Title, type: "title" },
      { fn: reactIndex.Video, type: "video" },
    ];

    for (const { fn, type } of elements) {
      const element = fn({});
      expect(element.type).toBe(type);
    }
  });

  test("element functions accept props and children", () => {
    const childImage = reactIndex.Image({ src: "child.png" });
    const clip = reactIndex.Clip({
      duration: 5,
      transition: { name: "fade", duration: 0.5 },
      children: [childImage],
    });

    expect(clip.type).toBe("clip");
    expect(clip.props.duration).toBe(5);
    expect(clip.children).toHaveLength(1);
    expect(clip.children[0]).toBe(childImage);
  });

  test("exports are not undefined", () => {
    const exportedKeys = Object.keys(reactIndex);
    expect(exportedKeys.length).toBeGreaterThan(0);

    for (const key of exportedKeys) {
      const value = reactIndex[key as keyof typeof reactIndex];
      expect(value).not.toBeUndefined();
    }
  });
});