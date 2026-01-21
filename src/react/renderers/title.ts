import type { TitleLayer } from "../../ai-sdk/providers/editly/types";
import type { TitleProps, VargElement } from "../types";
import { getTextContent } from "./utils";

export function renderTitle(element: VargElement<"title">): TitleLayer {
  const props = element.props as TitleProps;
  const text = getTextContent(element.children);

  return {
    type: "title",
    text,
    textColor: props.color,
    position: props.position,
    start: props.start,
    stop: props.end,
  };
}
