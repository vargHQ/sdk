import { experimental_transcribe as transcribe } from "ai";
import { openai } from "../index";

async function main() {
  const audioPath = process.argv[2] || "media/sample-audio.mp3";
  console.log(`transcribing ${audioPath} with whisper-1...`);

  const audioFile = Bun.file(audioPath);
  const audioBuffer = await audioFile.arrayBuffer();

  const result = await transcribe({
    model: openai.transcriptionModel("whisper-1"),
    audio: new Uint8Array(audioBuffer),
    providerOptions: {
      openai: {
        language: "en",
        timestamp_granularities: ["segment"],
      },
    },
  });

  console.log("\ntranscription:");
  console.log(result.text);

  if (result.segments && result.segments.length > 0) {
    console.log("\nsegments:");
    for (const segment of result.segments) {
      console.log(
        `  [${segment.startSecond.toFixed(2)}s - ${segment.endSecond.toFixed(2)}s] ${segment.text}`,
      );
    }
  }

  console.log("\ndone!");
}

main().catch(console.error);
