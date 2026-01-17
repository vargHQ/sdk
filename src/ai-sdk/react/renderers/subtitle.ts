import type { SubtitleLayer } from "../../providers/editly/types";
import type { SubtitleProps, VargElement } from "../types";
import { getTextContent } from "./utils";

export function renderSubtitle(
  element: VargElement<"subtitle">,
): SubtitleLayer {
  const props = element.props as SubtitleProps;
  const text = getTextContent(element.children);

  return {
    type: "subtitle",
    text,
    backgroundColor: props.backgroundColor,
  };
}
