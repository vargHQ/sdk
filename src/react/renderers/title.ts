import type { TitleLayer } from "../../ai-sdk/providers/editly/types";
import type { TitleProps, VargElement } from "../types";
import { getTextContent } from "./utils";

export function renderTitle(element: VargElement<"title">): TitleLayer {
  const props = element.props as TitleProps;
  const text = getTextContent(element.children) || props.text || "";

  return {
    type: "title",
    text,
    textColor: props.color,
    fontPath: props.fontPath,
    fontFamily: props.fontFamily,
    position: props.position,
    outline: props.outline,
    outlineColor: props.outlineColor,
    start: props.start,
    stop: props.end,
  };
}
