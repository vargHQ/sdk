/**
 * Test: upload a binary file to gateway and verify it's not corrupted.
 * Tests the exact path: render → POST /v1/files → R2 → download → verify
 *
 * Usage:
 *   bun run test-upload-binary.ts
 */

// Minimal valid PNG with bytes > 0x7F that would be corrupted by UTF-8 text conversion
const PNG_HEADER = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02,
  0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44,
  0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00, 0x00, 0x02, 0x00,
  0x01, 0xe2, 0x21, 0xbc, 0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44,
  0xae, 0x42, 0x60, 0x82,
]);

const GATEWAY_URL =
  process.env.GATEWAY_URL || "https://varg-gateway.fly.dev/v1";
const API_KEY = process.env.VARG_API_KEY;
if (!API_KEY) {
  console.error("VARG_API_KEY env var is required.");
  process.exit(1);
}

console.log(`Gateway: ${GATEWAY_URL}`);
console.log(`PNG data: ${PNG_HEADER.length} bytes`);
console.log(`First byte: 0x${PNG_HEADER[0]!.toString(16)} (should be 0x89)\n`);

// Step 1: Upload binary file (same as VargClient.uploadFile)
console.log("--- Step 1: Upload to gateway POST /v1/files ---");
const blob = new Blob([PNG_HEADER], { type: "image/png" });

const uploadRes = await fetch(`${GATEWAY_URL}/files`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "image/png",
  },
  body: blob,
});

const uploadBody = (await uploadRes.json()) as {
  url?: string;
  size?: number;
  error?: string;
  message?: string;
};
console.log(`  HTTP ${uploadRes.status}`);
console.log(`  ${JSON.stringify(uploadBody)}\n`);

if (!uploadBody.url) {
  console.error("Upload failed — no URL returned");
  process.exit(1);
}

// Step 2: Download and verify
console.log("--- Step 2: Download and verify ---");
const downloadRes = await fetch(uploadBody.url);
const downloadedBuffer = await downloadRes.arrayBuffer();
const downloaded = new Uint8Array(downloadedBuffer);

console.log(
  `  Downloaded: ${downloaded.length} bytes (expected ${PNG_HEADER.length})`,
);
console.log(
  `  First 3 bytes: ${Array.from(downloaded.slice(0, 3))
    .map((b) => "0x" + b.toString(16).padStart(2, "0"))
    .join(" ")}`,
);
console.log(`  Expected:      0x89 0x50 0x4e`);

// Byte-by-byte comparison
let corrupted = false;
const corruptions: string[] = [];
for (let i = 0; i < Math.max(PNG_HEADER.length, downloaded.length); i++) {
  const orig = PNG_HEADER[i];
  const dl = downloaded[i];
  if (orig !== dl) {
    corruptions.push(
      `  byte[${i}]: original=0x${(orig ?? 0).toString(16).padStart(2, "0")} downloaded=0x${(dl ?? 0).toString(16).padStart(2, "0")}`,
    );
    corrupted = true;
  }
}

if (corrupted) {
  console.log(`\n  CORRUPTED — ${corruptions.length} byte mismatches:`);
  for (const c of corruptions.slice(0, 10)) console.log(c);
  if (corruptions.length > 10)
    console.log(`  ... and ${corruptions.length - 10} more`);

  const first3hex = Array.from(downloaded.slice(0, 3))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
  if (first3hex === "ef bf bd") {
    console.log("\n  Pattern: 0x89 → EF BF BD (UTF-8 replacement character)");
    console.log(
      "  ROOT CAUSE: binary data was decoded as UTF-8 text somewhere in the upload pipeline",
    );
  }
} else {
  console.log("\n  FILE INTEGRITY OK — no corruption");
}

console.log("\n--- Done ---");
