import type { File } from "../ai-sdk/file";
import type { ElementMeta, VargElementType, VargNode } from "./types";

/**
 * A VargElement that has been resolved via `await`.
 *
 * Contains the generated file, probed duration, and other metadata.
 * Satisfies the VargElement interface structurally, so it can be used
 * anywhere a VargElement is accepted (Clip children, Captions src, etc.).
 *
 * @example
 * ```tsx
 * const audio = await Speech({ voice: "adam", children: "Hello world" });
 * // audio instanceof ResolvedElement === true
 * // audio.duration === 3.8
 * // audio.type === "speech"
 *
 * <Clip duration={audio.duration}>
 *   {audio}
 * </Clip>
 * ```
 */
export class ResolvedElement<T extends VargElementType = VargElementType> {
  readonly type: T;
  readonly props: Record<string, unknown>;
  readonly children: VargNode[];
  readonly meta: ElementMeta;

  constructor(
    element: { type: T; props: Record<string, unknown>; children: VargNode[] },
    meta: ElementMeta,
  ) {
    this.type = element.type;
    this.props = element.props;
    this.children = element.children;
    this.meta = meta;
  }

  /** Duration of the generated media in seconds. 0 for images. */
  get duration(): number {
    return this.meta.duration;
  }

  /** The generated file. */
  get file(): File {
    return this.meta.file;
  }

  /** Aspect ratio of the generated media, if applicable. */
  get aspectRatio(): string | undefined {
    return this.meta.aspectRatio;
  }
}
