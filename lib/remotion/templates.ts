/**
 * remotion composition templates
 * used by createComposition to generate starter files
 */

export function getCompositionTemplate(name: string): string {
  return `import React from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  Audio,
  Img,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  staticFile,
} from "remotion";

export const ${name}: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // TODO: customize your composition
  // Example: const video = staticFile("video.mp4");
  // Example: const audio = staticFile("audio.mp3");

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {/* Add your content here */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 60,
          color: "white",
        }}
      >
        Frame {frame}
      </div>
    </AbsoluteFill>
  );
};
`;
}

export function getRootTemplate(name: string): string {
  return `import React from "react";
import { Composition, registerRoot } from "remotion";
import { ${name} } from "./${name}";

// TODO: configure your composition settings
const fps = 30;
const durationInFrames = 150; // 5 seconds at 30fps
const width = 1920;
const height = 1080;

registerRoot(() => {
  return (
    <>
      <Composition
        id="${name}"
        component={${name}}
        durationInFrames={durationInFrames}
        fps={fps}
        width={width}
        height={height}
      />
    </>
  );
});
`;
}
