import { elevenlabs, generateMusic } from "../index";

async function main() {
  console.log("generating rap beat...");

  const { audio } = await generateMusic({
    model: elevenlabs.musicModel(),
    prompt:
      "hard hitting trap beat, 808 bass, hi-hats, dark and aggressive vibe, 140 bpm",
    duration: 30,
  });

  console.log(`audio: ${audio.uint8Array.byteLength} bytes`);

  await Bun.write("output/rap-beat.mp3", audio.uint8Array);
  console.log("saved to output/rap-beat.mp3");
}

main().catch(console.error);
