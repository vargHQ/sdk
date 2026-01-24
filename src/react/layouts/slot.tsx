import type { CropPosition, ResizeMode } from "../../ai-sdk/providers/editly/types";
import type { VargElement } from "../types";

type SlotFit = "cover" | "contain" | "contain-blur" | "fill";

type SlotPosition =
  | "center"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

interface SlotProps {
  class?: string;
  fit?: SlotFit;
  position?: SlotPosition;
  children: VargElement;
}

interface ParsedSlotClass {
  fit?: SlotFit;
  position?: SlotPosition;
}

function parseSlotClass(classString?: string): ParsedSlotClass {
  if (!classString) return {};
  const result: ParsedSlotClass = {};

  for (const cls of classString.trim().split(/\s+/)) {
    if (cls === "fit-cover") result.fit = "cover";
    else if (cls === "fit-contain") result.fit = "contain";
    else if (cls === "fit-contain-blur") result.fit = "contain-blur";
    else if (cls === "fit-fill") result.fit = "fill";
    else if (cls === "pos-center") result.position = "center";
    else if (cls === "pos-top") result.position = "top";
    else if (cls === "pos-bottom") result.position = "bottom";
    else if (cls === "pos-left") result.position = "left";
    else if (cls === "pos-right") result.position = "right";
    else if (cls === "pos-top-left") result.position = "top-left";
    else if (cls === "pos-top-right") result.position = "top-right";
    else if (cls === "pos-bottom-left") result.position = "bottom-left";
    else if (cls === "pos-bottom-right") result.position = "bottom-right";
  }
  return result;
}

function slotFitToResize(fit: SlotFit): ResizeMode {
  switch (fit) {
    case "cover": return "cover";
    case "contain": return "contain";
    case "contain-blur": return "contain-blur";
    case "fill": return "stretch";
  }
}

export const Slot = ({ class: className, fit, position, children }: SlotProps) => {
  const parsed = parseSlotClass(className);
  const resolvedFit = fit ?? parsed.fit ?? "cover";
  const resolvedPosition = position ?? parsed.position ?? "center";

  return {
    ...children,
    props: {
      ...children.props,
      resize: slotFitToResize(resolvedFit),
      cropPosition: resolvedPosition as CropPosition,
    },
  } as VargElement;
};
