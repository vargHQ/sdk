import type { VargElement } from "../types";
import { GENERATABLE_TYPES } from "./constants";
import { isPreResolved } from "./helpers";
import type { Diagnostic } from "./types";

/** Callback for recording a diagnostic during validation. */
export type DiagnosticAdder = (
  severity: Diagnostic["severity"],
  code: string,
  message: string,
  path: string[],
) => void;

/**
 * Validate a generable element: source presence, model availability,
 * keepAudio applicability, and video audio conflicts.
 */
export function validateElement(
  element: VargElement,
  path: string[],
  addDiagnostic: DiagnosticAdder,
): void {
  const props = element.props;
  const hasTextChildren = element.children.some(
    (c) => typeof c === "string" && c.length > 0,
  );
  const hasSource =
    props.src != null ||
    props.prompt != null ||
    isPreResolved(element) ||
    (element.type === "speech" && hasTextChildren) ||
    (element.type === "audio" && props.parent != null) ||
    element.type === "talking-head";

  if (!hasSource) {
    const requirement =
      element.type === "speech"
        ? "text children"
        : element.type === "audio"
          ? "'parent' or 'src'"
          : "'prompt' or 'src'";
    addDiagnostic(
      "error",
      "VARG_MISSING_SOURCE",
      `<${element.type}> requires ${requirement}`,
      path,
    );
  }

  // Model required when generating (prompt without src), except audio/slice/ffmpeg/probe
  if (
    props.prompt != null &&
    props.src == null &&
    props.model == null &&
    !isPreResolved(element) &&
    GENERATABLE_TYPES.has(element.type)
  ) {
    addDiagnostic(
      "warning",
      "VARG_MISSING_MODEL",
      `<${element.type}> has a prompt but no 'model' — will fall back to defaults at render time`,
      path,
    );
  }

  if (element.type === "video") {
    validateVideoAudioProps(element, path, addDiagnostic);
  }

  if (
    element.type !== "video" &&
    element.type !== "audio" &&
    props.keepAudio !== undefined &&
    element.type !== "talking-head"
  ) {
    addDiagnostic(
      "warning",
      "VARG_KEEP_AUDIO_IGNORED",
      `'keepAudio' has no effect on <${element.type}>`,
      path,
    );
  }
}

/**
 * Validate `audio: "native"` conflicts on a Video element:
 * - keepAudio: false
 * - providerOptions.<key>.generate_audio: false (top-level)
 * - providerOptions.<key>.<nested>.generate_audio: false (gateway nesting)
 */
export function validateVideoAudioProps(
  element: VargElement,
  path: string[],
  addDiagnostic: DiagnosticAdder,
): void {
  const props = element.props;
  if (props.audio !== "native") return;

  if (props.keepAudio === false) {
    addDiagnostic(
      "error",
      "VARG_AUDIO_CONFLICT",
      `audio: "native" conflicts with keepAudio: false — native audio would be generated and then dropped. Remove one of them.`,
      path,
    );
  }

  const providerOptions = props.providerOptions as
    | Record<string, Record<string, unknown>>
    | undefined;
  if (!providerOptions) return;

  for (const [providerKey, opts] of Object.entries(providerOptions)) {
    if (opts && opts.generate_audio === false) {
      addDiagnostic(
        "error",
        "VARG_AUDIO_CONFLICT",
        `audio: "native" conflicts with providerOptions.${providerKey}.generate_audio: false`,
        path,
      );
    }
    // Check nested varg.<provider>.generate_audio (gateway models route
    // options through providerOptions.varg.fal.* etc.)
    if (opts && typeof opts === "object") {
      for (const [nestedKey, nestedOpts] of Object.entries(opts)) {
        if (
          nestedOpts &&
          typeof nestedOpts === "object" &&
          (nestedOpts as Record<string, unknown>).generate_audio === false
        ) {
          addDiagnostic(
            "error",
            "VARG_AUDIO_CONFLICT",
            `audio: "native" conflicts with providerOptions.${providerKey}.${nestedKey}.generate_audio: false`,
            path,
          );
        }
      }
    }
  }
}
