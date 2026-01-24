import type { SlotFit, SlotPosition, SlotProps } from "../types";

export interface ParsedSlotOptions {
  fit: SlotFit;
  position: SlotPosition;
  bgBlur?: number;
  bgDim?: number;
  bgScale?: number;
  bgColor?: string;
}

/**
 * Parse Tailwind-style slot class string into options
 *
 * Supported classes:
 * - fit-cover | fit-contain | fit-fill | fit-none
 * - pos-center | pos-top | pos-bottom | pos-left | pos-right
 * - pos-top-left | pos-top-right | pos-bottom-left | pos-bottom-right
 * - bg-blur-{0-100}
 * - bg-dim-{0-100}
 * - bg-scale-{100-200}
 * - bg-color-{hex}
 */
export function parseSlotClass(
  classString?: string,
): Partial<ParsedSlotOptions> {
  if (!classString) return {};

  const result: Partial<ParsedSlotOptions> = {};
  const classes = classString.trim().split(/\s+/);

  for (const cls of classes) {
    // Fit classes
    if (cls === "fit-cover") result.fit = "cover";
    else if (cls === "fit-contain") result.fit = "contain";
    else if (cls === "fit-fill") result.fit = "fill";
    else if (cls === "fit-none") result.fit = "none";
    // Position classes
    else if (cls === "pos-center") result.position = "center";
    else if (cls === "pos-top") result.position = "top";
    else if (cls === "pos-bottom") result.position = "bottom";
    else if (cls === "pos-left") result.position = "left";
    else if (cls === "pos-right") result.position = "right";
    else if (cls === "pos-top-left") result.position = "top-left";
    else if (cls === "pos-top-right") result.position = "top-right";
    else if (cls === "pos-bottom-left") result.position = "bottom-left";
    else if (cls === "pos-bottom-right") result.position = "bottom-right";
    // Background blur
    else if (cls.startsWith("bg-blur-")) {
      const value = parseInt(cls.replace("bg-blur-", ""), 10);
      if (!isNaN(value) && value >= 0 && value <= 100) {
        result.bgBlur = value;
      }
    }

    // Background dim
    else if (cls.startsWith("bg-dim-")) {
      const value = parseInt(cls.replace("bg-dim-", ""), 10);
      if (!isNaN(value) && value >= 0 && value <= 100) {
        result.bgDim = value;
      }
    }

    // Background scale
    else if (cls.startsWith("bg-scale-")) {
      const value = parseInt(cls.replace("bg-scale-", ""), 10);
      if (!isNaN(value) && value >= 100 && value <= 200) {
        result.bgScale = value;
      }
    }

    // Background color
    else if (cls.startsWith("bg-color-")) {
      const hex = cls.replace("bg-color-", "");
      if (/^[0-9a-fA-F]{6}$/.test(hex)) {
        result.bgColor = `#${hex}`;
      }
    }
  }

  return result;
}

/**
 * Resolve slot options from props, merging class string with explicit props
 * Explicit props take precedence over class string
 */
export function resolveSlotOptions(props: SlotProps): ParsedSlotOptions {
  const fromClass = parseSlotClass(props.class);

  return {
    fit: props.fit ?? fromClass.fit ?? "cover",
    position: props.position ?? fromClass.position ?? "center",
    bgBlur: props.bgBlur ?? fromClass.bgBlur,
    bgDim: props.bgDim ?? fromClass.bgDim,
    bgScale: props.bgScale ?? fromClass.bgScale,
    bgColor: props.bgColor ?? fromClass.bgColor,
  };
}

/**
 * Convert SlotPosition to ffmpeg crop/overlay position expressions
 */
export function getPositionExpressions(
  position: SlotPosition,
  _containerWidth: number,
  _containerHeight: number,
): { x: string; y: string } {
  switch (position) {
    case "top-left":
      return { x: "0", y: "0" };
    case "top":
      return { x: "(ow-iw)/2", y: "0" };
    case "top-right":
      return { x: "ow-iw", y: "0" };
    case "left":
      return { x: "0", y: "(oh-ih)/2" };
    case "center":
      return { x: "(ow-iw)/2", y: "(oh-ih)/2" };
    case "right":
      return { x: "ow-iw", y: "(oh-ih)/2" };
    case "bottom-left":
      return { x: "0", y: "oh-ih" };
    case "bottom":
      return { x: "(ow-iw)/2", y: "oh-ih" };
    case "bottom-right":
      return { x: "ow-iw", y: "oh-ih" };
    default:
      return { x: "(ow-iw)/2", y: "(oh-ih)/2" };
  }
}

/**
 * Convert SlotPosition to ffmpeg crop position for cover mode
 * Returns crop position relative to input video dimensions
 */
export function getCropPosition(position: SlotPosition): {
  x: string;
  y: string;
} {
  switch (position) {
    case "top-left":
      return { x: "0", y: "0" };
    case "top":
      return { x: "(iw-ow)/2", y: "0" };
    case "top-right":
      return { x: "iw-ow", y: "0" };
    case "left":
      return { x: "0", y: "(ih-oh)/2" };
    case "center":
      return { x: "(iw-ow)/2", y: "(ih-oh)/2" };
    case "right":
      return { x: "iw-ow", y: "(ih-oh)/2" };
    case "bottom-left":
      return { x: "0", y: "ih-oh" };
    case "bottom":
      return { x: "(iw-ow)/2", y: "ih-oh" };
    case "bottom-right":
      return { x: "iw-ow", y: "ih-oh" };
    default:
      return { x: "(iw-ow)/2", y: "(ih-oh)/2" };
  }
}
