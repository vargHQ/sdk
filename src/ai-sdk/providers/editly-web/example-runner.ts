import type { Clip } from "../editly/types";
import { editlyWeb } from "./index";

const statusEl = document.getElementById("status")!;
const generateBtn = document.getElementById("generate") as HTMLButtonElement;
const downloadBtn = document.getElementById("download") as HTMLButtonElement;
const previewEl = document.getElementById("preview") as HTMLVideoElement;
const videoFilesInput = document.getElementById(
  "videoFiles",
) as HTMLInputElement;
const useHTMLVideoCheckbox = document.getElementById(
  "useHTMLVideo",
) as HTMLInputElement;

let videoBlob: Blob | null = null;

generateBtn.addEventListener("click", async () => {
  const files = videoFilesInput.files;

  if (!files || files.length === 0) {
    statusEl.textContent = "please select at least one video file";
    return;
  }

  generateBtn.disabled = true;
  downloadBtn.disabled = true;
  statusEl.textContent = `loading ${files.length} video(s)...`;

  try {
    const sources = new Map<string, ArrayBuffer>();
    const clips: Clip[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      statusEl.textContent = `loading ${file.name}...`;
      const buffer = await file.arrayBuffer();
      const path = `video-${i}`;
      sources.set(path, buffer);

      clips.push({
        layers: [{ type: "video", path }],
      });
    }

    const useHTMLVideo = useHTMLVideoCheckbox.checked;
    statusEl.textContent = `encoding ${files.length} clip(s)${useHTMLVideo ? " (using HTMLVideoSource)" : ""}...`;
    console.log(
      "[example] Starting editlyWeb with clips:",
      clips,
      "useHTMLVideo:",
      useHTMLVideo,
    );
    const startTime = performance.now();

    const mp4Data = await editlyWeb({
      width: 1280,
      height: 720,
      fps: 30,
      clips,
      sources,
      useHTMLVideo,
    });

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
    const sizeMb = (mp4Data.length / 1024 / 1024).toFixed(2);
    statusEl.textContent = `done! ${sizeMb}mb in ${elapsed}s`;

    videoBlob = new Blob([new Uint8Array(mp4Data)], { type: "video/mp4" });
    const url = URL.createObjectURL(videoBlob);
    previewEl.src = url;
    previewEl.play();

    downloadBtn.disabled = false;
  } catch (err) {
    statusEl.textContent = `error: ${err instanceof Error ? err.message : err}`;
    console.error(err);
  } finally {
    generateBtn.disabled = false;
  }
});

downloadBtn.addEventListener("click", () => {
  if (!videoBlob) return;

  const url = URL.createObjectURL(videoBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "editly-web-output.mp4";
  a.click();
  URL.revokeObjectURL(url);
});
