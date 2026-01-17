import type { VargElement, VargNode } from "../react/types";

export type StageType = "image" | "video" | "animate" | "speech" | "music";

export interface RenderStage {
  id: string;
  type: StageType;
  label: string;
  element: VargElement;
  path: string[]; // path in the tree for identification
  dependsOn: string[]; // stage ids this depends on
  status: "pending" | "running" | "complete" | "error";
  result?: StageResult;
}

export interface StageResult {
  type: "image" | "video" | "audio";
  path: string;
  previewUrl?: string;
  mimeType: string;
}

export interface ExtractedStages {
  stages: RenderStage[];
  order: string[]; // topologically sorted stage ids
}

/**
 * Extracts all renderable stages from a JSX tree in dependency order.
 * Images come before videos that use them, etc.
 */
export function extractStages(element: VargElement): ExtractedStages {
  const stages: RenderStage[] = [];
  let stageCounter = 0;

  function generateId(): string {
    return `stage-${stageCounter++}`;
  }

  function getLabel(type: StageType, element: VargElement): string {
    const props = element.props as Record<string, unknown>;

    if (type === "image") {
      const prompt = props.prompt;
      if (typeof prompt === "string") {
        return `image: ${prompt.slice(0, 30)}${prompt.length > 30 ? "..." : ""}`;
      }
      if (prompt && typeof prompt === "object" && "text" in prompt) {
        const text = (prompt as { text?: string }).text ?? "";
        return `image: ${text.slice(0, 30)}${text.length > 30 ? "..." : ""}`;
      }
      if (props.src) {
        return `image: ${String(props.src).split("/").pop()}`;
      }
      return "image";
    }

    if (type === "video") {
      const prompt = props.prompt;
      if (typeof prompt === "string") {
        return `video: ${prompt.slice(0, 30)}${prompt.length > 30 ? "..." : ""}`;
      }
      if (prompt && typeof prompt === "object" && "text" in prompt) {
        const text = (prompt as { text?: string }).text ?? "";
        return `video: ${text.slice(0, 30)}${text.length > 30 ? "..." : ""}`;
      }
      if (props.src) {
        return `video: ${String(props.src).split("/").pop()}`;
      }
      return "video";
    }

    if (type === "animate") {
      const motion = props.motion;
      return motion ? `animate: ${motion}` : "animate";
    }

    if (type === "speech") {
      const text = getTextContent(element.children);
      return `speech: ${text.slice(0, 30)}${text.length > 30 ? "..." : ""}`;
    }

    if (type === "music") {
      const prompt = props.prompt;
      if (typeof prompt === "string") {
        return `music: ${prompt.slice(0, 30)}${prompt.length > 30 ? "..." : ""}`;
      }
      if (props.src) {
        return `music: ${String(props.src).split("/").pop()}`;
      }
      return "music";
    }

    return type;
  }

  function getTextContent(children: VargNode[]): string {
    const texts: string[] = [];
    for (const child of children) {
      if (typeof child === "string") {
        texts.push(child);
      } else if (typeof child === "number") {
        texts.push(String(child));
      }
    }
    return texts.join(" ");
  }

  function walkTree(
    node: VargNode,
    path: string[],
    parentDeps: string[],
  ): string[] {
    if (!node || typeof node !== "object" || !("type" in node)) {
      return [];
    }

    const element = node as VargElement;
    const currentPath = [...path, element.type];
    const collectedDeps: string[] = [...parentDeps];

    // Check if this is a renderable stage
    const stageTypes: StageType[] = [
      "image",
      "video",
      "animate",
      "speech",
      "music",
    ];

    if (stageTypes.includes(element.type as StageType)) {
      const stageType = element.type as StageType;
      const props = element.props as Record<string, unknown>;

      // Skip if it's just a src reference (no generation needed)
      if (props.src && !props.prompt) {
        return [];
      }

      // For video/animate with image inputs, we need to find dependent images first
      const imageDeps: string[] = [];

      if (stageType === "video" || stageType === "animate") {
        // Check prompt.images for nested Image elements
        const prompt = props.prompt as { images?: VargNode[] } | undefined;
        if (prompt?.images) {
          for (const imgInput of prompt.images) {
            if (
              imgInput &&
              typeof imgInput === "object" &&
              "type" in imgInput
            ) {
              const imgElement = imgInput as VargElement;
              if (imgElement.type === "image") {
                const deps = walkTree(imgElement, currentPath, collectedDeps);
                imageDeps.push(...deps);
              }
            }
          }
        }

        // Check for image prop in animate
        if (stageType === "animate" && props.image) {
          const imgElement = props.image as VargElement;
          if (imgElement.type === "image") {
            const deps = walkTree(imgElement, currentPath, collectedDeps);
            imageDeps.push(...deps);
          }
        }
      }

      const id = generateId();
      const stage: RenderStage = {
        id,
        type: stageType,
        label: getLabel(stageType, element),
        element,
        path: currentPath,
        dependsOn: [...new Set([...collectedDeps, ...imageDeps])],
        status: "pending",
      };

      stages.push(stage);
      return [id];
    }

    // For container elements (render, clip, overlay), recurse into children
    const childDeps: string[] = [];
    for (const child of element.children) {
      const deps = walkTree(child, currentPath, collectedDeps);
      childDeps.push(...deps);
    }

    return childDeps;
  }

  // Start walking from root
  if (element.type === "render") {
    walkTree(element, [], []);
  }

  // Topological sort based on dependencies
  const order = topologicalSort(stages);

  return { stages, order };
}

function topologicalSort(stages: RenderStage[]): string[] {
  const result: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const stageMap = new Map(stages.map((s) => [s.id, s]));

  function visit(id: string) {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      throw new Error(`Circular dependency detected at stage ${id}`);
    }

    visiting.add(id);
    const stage = stageMap.get(id);
    if (stage) {
      for (const depId of stage.dependsOn) {
        visit(depId);
      }
    }
    visiting.delete(id);
    visited.add(id);
    result.push(id);
  }

  for (const stage of stages) {
    visit(stage.id);
  }

  return result;
}

/**
 * Serializes stages for API response (strips non-serializable element)
 */
export function serializeStages(extracted: ExtractedStages): {
  stages: Omit<RenderStage, "element">[];
  order: string[];
} {
  return {
    stages: extracted.stages.map(({ element, ...rest }) => rest),
    order: extracted.order,
  };
}
