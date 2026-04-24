/**
 * HeyGen Avatar Talking Video Example
 *
 * Generates a talking avatar video using a pre-registered HeyGen avatar
 * with built-in TTS. This is the simplest way to create a talking head —
 * one API call handles voice synthesis + lip sync + rendering.
 *
 * Usage:
 *   bun examples/heygen-avatar-talking.ts
 *
 * Requires:
 *   HEYGEN_API_KEY in .env
 *
 * Cost:
 *   ~$0.10/second of video. A 10s script ≈ $1.00.
 */

import { HeyGenProvider } from "../src/providers/heygen";

const provider = new HeyGenProvider();

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// Pick an avatar from the catalog (run `bun examples/heygen-avatar-talking.ts --list-avatars`)
const AVATAR_ID = "Annie_expressive10_public"; // Annie in Grey Jacket

// Pick a voice (run `bun examples/heygen-avatar-talking.ts --list-voices`)
const VOICE_ID = "f38a635bee7a4d1f9b0a654a31d050d2"; // Chill Brian (English, male)

const SCRIPT = `
Hey there! Welcome to varg AI.
I'm Annie, and I was generated entirely by artificial intelligence.
My voice, my lip movements, even my gestures — all synthesized in real time.
With HeyGen's avatar technology integrated into varg,
you can create talking head videos in just a few seconds.
Pretty cool, right?
`.trim();

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

if (args.includes("--list-voices")) {
  const voices = await provider.listVoices();
  const english = voices.filter((v) => v.language === "English");
  console.log(
    `\nEnglish voices (${english.length} of ${voices.length} total):\n`,
  );
  console.log(
    "voice_id                          | name                | gender",
  );
  console.log(
    "----------------------------------+---------------------+--------",
  );
  for (const v of english.slice(0, 30)) {
    const id = v.voice_id.padEnd(34);
    const name = v.name.trim().padEnd(20);
    console.log(`${id}| ${name}| ${v.gender}`);
  }
  console.log(
    `\n... and ${english.length - 30} more. Use voice_id directly in your code.`,
  );
  process.exit(0);
}

if (args.includes("--list-avatars")) {
  const { avatars } = await provider.listAvatars();
  console.log(`\nAvatars (${avatars.length} total):\n`);
  console.log(
    "avatar_id                              | name                         | gender",
  );
  console.log(
    "---------------------------------------+------------------------------+--------",
  );
  for (const a of avatars.slice(0, 30)) {
    const id = a.avatar_id.padEnd(39);
    const name = a.avatar_name.padEnd(30);
    console.log(`${id}| ${name}| ${a.gender ?? "?"}`);
  }
  console.log(`\n... and ${avatars.length - 30} more.`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Generate
// ---------------------------------------------------------------------------

console.log("=== HeyGen Avatar Talking Video ===\n");

const quota = await provider.getRemainingQuota();
console.log(`Remaining quota: ${quota} seconds`);

if (quota < 10) {
  console.error("Not enough quota! Need at least 10 seconds.");
  process.exit(1);
}

console.log(`\nAvatar: ${AVATAR_ID}`);
console.log(`Voice:  ${VOICE_ID}`);
console.log(`Script: "${SCRIPT.slice(0, 60)}..."`);
console.log("\nGenerating... (this takes 60-120 seconds)\n");

const start = Date.now();

const result = await provider.createAvatarVideo({
  script: SCRIPT,
  voiceId: VOICE_ID,
  avatarId: AVATAR_ID,
  aspectRatio: "16:9",
});

const elapsed = ((Date.now() - start) / 1000).toFixed(1);

console.log(`\nDone in ${elapsed}s!`);
console.log(`Duration: ${result.video.duration?.toFixed(1)}s`);
console.log(`Video:    ${result.video.url}`);

// Download to local file
const videoRes = await fetch(result.video.url);
const videoBytes = new Uint8Array(await videoRes.arrayBuffer());
const outputPath = `output/heygen-avatar-${Date.now()}.mp4`;
await Bun.write(outputPath, videoBytes);
console.log(`Saved:    ${outputPath}`);

const quotaAfter = await provider.getRemainingQuota();
console.log(
  `\nQuota used: ${quota - quotaAfter} seconds (${quotaAfter} remaining)`,
);
