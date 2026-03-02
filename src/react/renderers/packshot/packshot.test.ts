import { describe, expect, test } from "bun:test";
import {
  type BlinkingButtonPngs,
  buildBlinkingButtonFilter,
  even,
  getButtonYPosition,
  hexToRgb,
  oscExpr,
} from "./blinking-button";

// ─── Helper unit tests ───────────────────────────────────────────────────────

describe("blinking-button helpers", () => {
  test("hexToRgb parses valid hex colors", () => {
    expect(hexToRgb("#FF6B00")).toEqual({ r: 255, g: 107, b: 0 });
    expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb("#FFFFFF")).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb("FF6B00")).toEqual({ r: 255, g: 107, b: 0 }); // no #
  });

  test("hexToRgb returns default for invalid input", () => {
    expect(hexToRgb("invalid")).toEqual({ r: 255, g: 107, b: 0 });
    expect(hexToRgb("")).toEqual({ r: 255, g: 107, b: 0 });
  });

  test("even ensures even numbers", () => {
    expect(even(10)).toBe(10);
    expect(even(11)).toBe(12);
    expect(even(0)).toBe(0);
    expect(even(1)).toBe(2);
  });

  test("oscExpr produces well-formed ffmpeg expression", () => {
    const expr = oscExpr("t", 0.8);
    expect(expr).toContain("mod(t,0.8)");
    expect(expr).toContain("sin(");
    expect(expr).toContain("cos(");
    expect(expr).toContain("1.15");
    expect(expr).toContain("PI");
    // Should not contain any undefined or NaN
    expect(expr).not.toContain("undefined");
    expect(expr).not.toContain("NaN");
  });

  test("getButtonYPosition returns correct positions", () => {
    const videoHeight = 1920;
    const buttonHeight = 200;

    const topY = getButtonYPosition("top", videoHeight, buttonHeight);
    const centerY = getButtonYPosition("center", videoHeight, buttonHeight);
    const bottomY = getButtonYPosition("bottom", videoHeight, buttonHeight);

    // Top should be near the top
    expect(topY).toBe(Math.floor(1920 * 0.15));
    // Center should be vertically centered
    expect(centerY).toBe(Math.floor((1920 - 200) / 2));
    // Bottom should be in the lower portion
    expect(bottomY).toBe(Math.floor(1920 * 0.78 - 200 / 2));

    // Ordering
    expect(topY).toBeLessThan(centerY);
    expect(centerY).toBeLessThan(bottomY);
  });
});

// ─── buildBlinkingButtonFilter tests ─────────────────────────────────────────

describe("buildBlinkingButtonFilter", () => {
  const mockPngs: BlinkingButtonPngs = {
    btnPngPath: "/tmp/test-btn.png",
    glowPngPath: "/tmp/test-glow.png",
    btnNativeW: 756,
    btnNativeH: 172,
    canvasWidth: 1000,
    canvasHeight: 300,
  };

  test("returns correct structure", () => {
    const result = buildBlinkingButtonFilter(2, 3, mockPngs, {
      duration: 5,
      fps: 30,
      blinkFrequency: 0.8,
    });

    expect(result.outputLabel).toBe("btn_out");
    expect(result.canvasWidth).toBe(1000);
    expect(result.canvasHeight).toBe(300);
    expect(result.filters).toBeInstanceOf(Array);
    expect(result.filters.length).toBeGreaterThan(0);
  });

  test("uses correct input indices", () => {
    const result = buildBlinkingButtonFilter(5, 6, mockPngs, {
      duration: 3,
      fps: 30,
      blinkFrequency: 0.8,
    });

    const joined = result.filters.join(";");
    // Should reference input 5 for button and 6 for glow
    expect(joined).toContain("[5:v]");
    expect(joined).toContain("[6:v]");
    // Should NOT reference old indices
    expect(joined).not.toContain("[0:v]");
    expect(joined).not.toContain("[1:v]");
  });

  test("filter contains animation expressions", () => {
    const result = buildBlinkingButtonFilter(0, 1, mockPngs, {
      duration: 5,
      fps: 30,
      blinkFrequency: 0.8,
    });

    const joined = result.filters.join(";");
    // Should contain gamma for brightness animation
    expect(joined).toContain("eq=gamma=");
    expect(joined).toContain("eval=frame");
    // Should contain scale for zoom animation
    expect(joined).toContain("scale=w=");
    // Should contain overlay for compositing
    expect(joined).toContain("overlay=");
    // Should contain transparent canvas generation
    expect(joined).toContain("color=0x00000000");
    // Should contain format=rgba for alpha handling
    expect(joined).toContain("format=rgba");
  });

  test("filter contains correct dimensions", () => {
    const result = buildBlinkingButtonFilter(0, 1, mockPngs, {
      duration: 3,
      fps: 24,
      blinkFrequency: 1.0,
    });

    const joined = result.filters.join(";");
    // Canvas dimensions
    expect(joined).toContain(
      `s=${mockPngs.canvasWidth}x${mockPngs.canvasHeight}`,
    );
    // FPS
    expect(joined).toContain("r=24");
    // Duration
    expect(joined).toContain("d=3");
  });

  test("final output label is btn_out", () => {
    const result = buildBlinkingButtonFilter(0, 1, mockPngs, {
      duration: 5,
      fps: 30,
      blinkFrequency: 0.8,
    });

    const lastFilter = result.filters[result.filters.length - 1]!;
    expect(lastFilter).toContain("[btn_out]");
  });
});
