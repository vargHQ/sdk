/** @jsxImportSource vargai */

import { elevenlabs, fal } from "vargai/ai";
import {
  Captions,
  Clip,
  Image,
  Music,
  Overlay,
  Render,
  Speech,
  Subtitle,
  Title,
  Video,
} from "vargai/react";

export default (
  <Render width={1920} height={1080} fps={30}>
    {/* Scene 1 */}
    <Clip duration={3}>
      <Video src="scene1.mp4" />
      <Title text="Introduction" position="top" />
      <Subtitle text="Welcome to our presentation" />
      <Speech text="Hello and welcome" />
    </Clip>

    {/* Scene 2 */}
    <Clip duration={4}>
      <Image src="graph1.jpg" />
      <Title text="Market Overview" />
      <Speech text="Let's look at the market trends" />
    </Clip>

    {/* Scene 3 */}
    <Clip duration={3}>
      <Video src="demo.mp4" />
      <Subtitle text="Live demonstration" />
    </Clip>

    {/* Scene 4 */}
    <Clip duration={2}>
      <Image src="chart1.jpg" />
      <Title text="Q1 Results" />
    </Clip>

    {/* Scene 5 */}
    <Clip duration={3}>
      <Video src="testimonial1.mp4" />
      <Speech text="Customer testimonial one" />
    </Clip>

    {/* Scene 6 */}
    <Clip duration={2}>
      <Image src="chart2.jpg" />
      <Title text="Q2 Results" />
    </Clip>

    {/* Scene 7 */}
    <Clip duration={3}>
      <Video src="testimonial2.mp4" />
      <Speech text="Customer testimonial two" />
    </Clip>

    {/* Scene 8 */}
    <Clip duration={2}>
      <Image src="chart3.jpg" />
      <Title text="Q3 Results" />
    </Clip>

    {/* Scene 9 */}
    <Clip duration={3}>
      <Video src="product-demo.mp4" />
      <Title text="New Features" />
      <Subtitle text="Released this quarter" />
    </Clip>

    {/* Scene 10 */}
    <Clip duration={2}>
      <Image src="roadmap.jpg" />
      <Title text="2026 Roadmap" />
    </Clip>

    {/* Scene 11 */}
    <Clip duration={3}>
      <Video src="team.mp4" />
      <Title text="Our Team" />
      <Speech text="Meet our amazing team" />
    </Clip>

    {/* Scene 12 */}
    <Clip duration={2}>
      <Image src="contact.jpg" />
      <Title text="Get in Touch" />
      <Subtitle text="contact@example.com" />
    </Clip>

    {/* Overlays */}
    <Overlay left={50} top={50} width={200} height={100}>
      <Video src="logo-animated.mp4" />
    </Overlay>

    <Overlay left={1650} top={950} width={220} height={80}>
      <Image src="watermark.png" />
    </Overlay>

    <Overlay left={100} top={900} width={150} height={150}>
      <Image src="qr-code.png" />
    </Overlay>

    {/* Audio */}
    <Music src="background-music.mp3" volume={0.2} />
    <Captions />
  </Render>
);
