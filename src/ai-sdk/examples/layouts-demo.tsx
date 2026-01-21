import {
  Clip,
  Image,
  Packshot,
  Render,
  render,
  Slider,
  Split,
  Swipe,
  Title,
} from "../../react";

async function main() {
  const img1 = Image({ src: "media/cyberpunk-street.png" });
  const img2 = Image({ src: "media/fal-coffee-shop.png" });
  const img3 = Image({ src: "media/kirill.png" });

  const video = (
    <Render width={1280} height={720}>
      <Clip duration={3}>
        <Split direction="horizontal">{[img1, img2]}</Split>
        <Title position="bottom">Split Layout</Title>
      </Clip>

      <Clip duration={4} transition={{ name: "fade", duration: 0.5 }}>
        <Slider direction="horizontal">{[img1, img2, img3]}</Slider>
      </Clip>

      <Clip duration={4} transition={{ name: "fade", duration: 0.5 }}>
        <Swipe direction="left" interval={1.5}>
          {[img1, img2, img3]}
        </Swipe>
      </Clip>

      <Clip duration={3} transition={{ name: "fade", duration: 0.5 }}>
        <Packshot
          background="#1a1a2e"
          logo="media/cyberpunk-street.png"
          logoPosition="center"
          logoSize="50%"
          cta="Subscribe for more!"
          ctaColor="#FFD700"
        />
      </Clip>
    </Render>
  );

  console.log("rendering layouts demo...\n");

  await render(video, {
    output: "output/layouts-demo.mp4",
  });

  console.log("\ndone! check output/layouts-demo.mp4");
}

main().catch(console.error);
