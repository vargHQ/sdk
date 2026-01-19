import { editly } from "../providers/editly";

async function main() {
  console.log("Testing editly implementation...\n");

  await editly({
    outPath: "output/editly-test.mp4",
    width: 640,
    height: 480,
    fps: 30,
    verbose: true,
    clips: [
      {
        duration: 3,
        layers: [
          { type: "fill-color", color: "#1a1a2e" },
          {
            type: "title",
            text: "Hello Editly!",
            textColor: "#ffffff",
            position: "center",
          },
        ],
      },
      {
        duration: 3,
        layers: [
          { type: "fill-color", color: "#16213e" },
          {
            type: "title",
            text: "Second Slide",
            textColor: "#e94560",
            position: "center",
          },
        ],
        transition: { name: "fade", duration: 0.5 },
      },
      {
        duration: 3,
        layers: [
          { type: "fill-color", color: "#0f3460" },
          {
            type: "title",
            text: "The End",
            textColor: "#ffffff",
            position: "center",
          },
        ],
        transition: { name: "fade", duration: 0.5 },
      },
    ],
  });

  console.log("\nDone!");
}

main().catch(console.error);
