# Prompting Kling & Nano-Banana-Pro

_Shared by Alex_

---

## Kling AI (Video Generation)

### Core Prompt Structure

A strong Kling prompt relies on four key elements: **subject**, **context**, **action**, and **style**. If you omit any of these, the model is forced to guess.

**Formula:**

```
[Subject] + [Action/Motion] + [Context/Setting] + [Camera/Style]
```

### What Makes Kling Special

- Kling's greatest strength is **camera motion** and **character physics**
- Works best with prompts under **40–50 words**, using clear and structured formatting
- The real magic shows up when you guide it visually, not just verbally—**reference-first prompting** with images

### Pro Techniques

#### Camera Control

- Add detailed camera movements: `"slow zoom-in"`, `"quick pan"`, `"aerial shot"`
- Include technical specifications like `"Shot on virtual anamorphic lens, 24mm, f/2.8"`—these function as stylistic cues

#### Weight Elements

Use emphasis indicators `(++)` for critical elements:

```
++sleek red convertible++ driving along coastal highway
```

#### Negative Prompts

Specify what to avoid:

```
No people, no text overlays, no distortion in vehicle proportions
```

### Image-to-Video Formula

For Image-to-Video, the essential elements are **subject** and **movement**. Unlike Text-to-Video, which requires scene description, Image-to-Video already has a scene provided by the input image.

**Example:**

```
Cat walking forward on the alien landscape, his tail swaying gently. 
Vibrant meteor shower fills the sky, with meteors streaking across.
```

### Common Pitfalls

- Requesting `"360-degree rotation around subject while zooming in"` often produces warped geometry due to multiple simultaneous camera transformations
- Avoid relying on specific numbers—the AI may struggle with consistency (e.g., "5 trees", "6 puppies")
- Mixing lighting terms like `"golden hour"` with `"studio lighting"` confuses the model's style interpretation

---

## Nano-Banana-Pro (Image Generation)

Google's latest model—internally "Gemini 3 Pro Image."

### Key Paradigm Shift

Nano-Banana Pro is a **"Thinking" model**. It doesn't just match keywords; it understands intent, physics, and composition. Stop using "tag soups" (e.g., `dog, park, 4k, realistic`) and start acting like a **Creative Director**.

### Core Prompt Formula

```
[Subject + Adjectives] doing [Action] in [Location/Context]. 
[Composition/Camera Angle]. [Lighting/Atmosphere]. [Style/Media]. 
[Specific Constraint/Text].
```

**ICS Method:** Always specify:

1. **Image type** — blueprint, infographic, diagram
2. **Content** — source data or information
3. **Visual style** — survival guide, McKinsey presentation, comic

### Killer Features

#### Text Rendering

Don't just say "add text." Be specific:

```
Write the text 'HELLO WORLD' in a bold, red, serif font on the sign.
```

Maximize text legibility by isolating string literals in double quotes. Explicitly define font family.

#### Conversational Editing

The model excels at understanding conversational edits. If an image is 80% correct, don't regenerate from scratch—simply ask for the specific change you need.

#### Search-Powered Generation

Nano-Banana Pro uses Google Search to generate imagery based on real-time data, current events, or factual verification.

#### Multi-Image Context

Supports a **14-image context window**. Upload images (style guides, logos, character sheets) and instruct:

```
Use the uploaded images as a strict style reference...
```

### Pro Tips

- Remove polite phrases like "please"—use command-line style syntax
- Trick the model into photorealism by specifying camera gear: `"Shot on Arri Alexa"` forces the AI to emulate specific film grain
- You don't need `"4k, trending on artstation, masterpiece"` spam anymore—Nano Banana Pro understands natural language

### Limitations

- Rendering small text, fine details, and producing accurate spellings may not work perfectly
- Always verify the factual accuracy of data-driven visuals like diagrams and infographics

---

## Quick Comparison

| Aspect | Kling | Nano-Banana-Pro |
|--------|-------|-----------------|
| **Type** | Video gen | Image gen |
| **Sweet Spot** | Camera motion, physics | Text rendering, editing |
| **Prompting Style** | Cinematic director | Creative director |
| **Best Input** | Image + motion prompt | Natural language + refs |
| **Iteration** | Re-generate | Conversational edits |

---

## TikTok-Style Prompts for Kling

### General Guidelines

- **Image-to-Video** gives more control (upload frame → describe movement)
- Specify **vertical 9:16** aspect ratio
- Keep prompts short (**40–50 words max**)
- Use **one camera movement type** at a time (don't mix pan + zoom + rotate)

### Timeline Breakdown

| Time | Action/Angle | Notes |
|------|--------------|-------|
| 0–1s | Hook — unusual expression or text question, frontal close-up | Capture attention in first 1–2 seconds |
| 1–4s | Switch to 45° medium shot; first grimace | Sharp angle change on music beat |
| 4–7s | Low angle or extreme close-up — funny angle; add text/emoji | Use jump cut to remove pause |
| 7–10s | High angle; new emotion, possible match cut or object cover | Insert reaction cutaway for smoothness |
| 10–13s | Show all four angles in 2×2 grid (optional) | Creates powerful final effect |
| 13–15s | Finale and CTA: return to frontal shot; deliver joke or call-to-action | End on strong beat; add text with CTA |

---

### Prompt Examples by Segment

#### 0–1 sec: Hook — Frontal Close-up

**Text-to-Video:**

```
Young woman, surprised expression with wide eyes, looking directly at camera. 
Extreme close-up face shot, static camera, soft ring light, vertical 9:16 format.
Cinematic, social media aesthetic, sharp focus on eyes.
```

**Image-to-Video:**

```
Woman's eyes widen in surprise, eyebrows raise slightly, subtle head tilt forward.
Static shot, no camera movement.
```

**Negative prompt:** `blur, camera shake, side profile, horizontal format`

---

#### 1–4 sec: 45° Medium Shot + Grimace

**Text-to-Video:**

```
Woman at 45-degree angle, medium shot showing torso and hands. 
She makes an exaggerated funny face, hands gesture expressively.
Camera slowly pushes in, soft natural lighting from window, vertical format.
TikTok influencer style, playful mood.
```

**Image-to-Video:**

```
Woman turns head 45 degrees, makes exaggerated grimace, 
hands move up near face expressively. Slow push-in camera movement.
```

**Tip:** Use `++grimace++` or `++expressive hands++` for emphasis

---

#### 4–7 sec: Low Angle or Extreme Close-up

**Option A — Low Angle:**

```
Woman filmed from below, low angle shot, looking down at camera with 
confident smirk. Dramatic perspective, she appears powerful and playful.
Static camera, vertical 9:16, slight lens distortion for comic effect.
```

**Option B — Extreme Close-up (eyes/lips):**

```
Extreme close-up of woman's eyes, pupils dilate slightly, 
eyebrow raises in surprise. Macro shot, shallow depth of field, 
ring light reflection in eyes. Static, vertical format.
```

**Negative prompt:** `full body, wide shot, horizontal, distortion in face proportions`

---

#### 7–10 sec: High Angle + New Emotion

**Text-to-Video:**

```
Woman filmed from above, high angle shot, she looks up at camera 
with playful vulnerability. Arms spread wide filling the frame.
Slow gentle tilt down, soft overhead lighting, vertical 9:16.
Cute, endearing mood, TikTok aesthetic.
```

**Image-to-Video:**

```
Woman looks up at camera, expression shifts from neutral to excited smile,
hands move into frame from sides. Subtle camera tilt, gentle movement.
```

---

#### 10–13 sec: Split Screen 2×2 (All 4 Angles)

Kling doesn't natively create grids—this is post-production. Options:

1. **Generate each angle separately** → combine in CapCut/Premiere
2. **Experimental mosaic prompt:**

```
Split screen 2x2 grid showing same woman from four angles simultaneously:
top-left frontal close-up, top-right 45-degree medium shot,
bottom-left low angle, bottom-right high angle.
All expressions different, synchronized movement, vertical format.
```

> ⚠️ Kling may struggle with consistency. Better to generate separately and combine.

---

#### 13–15 sec: Finale + CTA — Return to Frontal

**Text-to-Video:**

```
Woman, frontal close-up, delivers punchline directly to camera 
with confident smile. Slight head nod, wink at the end.
Static camera, punchy energy, vertical 9:16, TikTok creator vibe.
Sharp focus, professional ring lighting.
```

**Image-to-Video:**

```
Woman smiles confidently, delivers line to camera, 
subtle wink, slight forward lean. Static shot, no camera movement.
```

---

### Universal TikTok-Style Modifiers

Add to the end of prompts:

| Goal | Modifier |
|------|----------|
| **Vertical** | `vertical 9:16 format, portrait orientation` |
| **TikTok vibe** | `TikTok creator aesthetic, social media style` |
| **Lighting** | `ring light, soft natural window light, even lighting` |
| **Sharpness** | `sharp focus, high clarity, 1080p quality` |
| **Energy** | `dynamic, punchy, energetic mood` |

---

### Prompt Template for varg SDK

```javascript
const klingPromptTemplate = {
  subject: "Young woman, [EXPRESSION]",
  action: "[MOVEMENT/GESTURE]",
  camera: {
    angle: "[frontal/45-degree/low-angle/high-angle]",
    shot: "[extreme-close-up/close-up/medium-shot]",
    movement: "[static/slow-push-in/gentle-tilt]"
  },
  style: "TikTok creator aesthetic, vertical 9:16",
  lighting: "ring light, soft natural lighting",
  negative: "blur, horizontal format, camera shake"
};
```

---

## Pro Tips for Scale

- **Consistency via Image-to-Video** — Generate base frame in Flux/SDXL, then animate in Kling. Prevents face "drifting" between angles.
- **Batch prompts** — Create 3–4 expression variations per angle, then pick the best during editing.
- **Reference-first** — Kling works better when you provide an image and describe only the movement.
