import videoDecodeTest from "./video-decode-test.html";

const bundleResult = await Bun.build({
  entrypoints: [import.meta.dir + "/editly-bundle.ts"],
  target: "browser",
  minify: false,
});

if (!bundleResult.success) {
  console.error("Bundle failed:", bundleResult.logs);
  process.exit(1);
}

const editlyBundleJs = await bundleResult.outputs[0]!.text();
console.log(`Bundled editly-web: ${editlyBundleJs.length} bytes`);

const videoCombineHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Video Combine Test - HTMLVideoSource</title>
  <style>
    body { font-family: monospace; padding: 20px; background: #1a1a1a; color: #0f0; }
    pre { white-space: pre-wrap; }
    .error { color: #f00; }
    .success { color: #0f0; }
    .info { color: #0af; }
    video { max-width: 100%; margin-top: 20px; border: 1px solid #333; }
  </style>
</head>
<body>
  <h2>Video Combine Test - Using HTMLVideoSource</h2>
  <p>This test uses the native &lt;video&gt; element approach (HTMLVideoSource) to decode videos,
     then re-encodes them with editlyWeb.</p>
  <pre id="log"></pre>
  <video id="preview" controls></video>
  
  <script type="module">
    import { editlyWeb, HTMLVideoSource } from '/editly-bundle.js';

    const logEl = document.getElementById('log');
    const preview = document.getElementById('preview');
    
    function log(msg, type = 'info') {
      const line = document.createElement('div');
      line.className = type;
      line.textContent = \`[\${new Date().toISOString().slice(11, 23)}] \${msg}\`;
      logEl.appendChild(line);
      console.log(msg);
    }

    window.testResults = null;

    async function runTests() {
      const results = [];
      
      async function runTest(name, fn) {
        try {
          log(\`Running: \${name}...\`, 'info');
          await fn();
          results.push({ name, passed: true });
          log(\`PASS: \${name}\`, 'success');
        } catch (e) {
          results.push({ name, passed: false, error: e.message });
          log(\`FAIL: \${name}: \${e.message}\`, 'error');
          console.error(e);
        }
      }

      try {
        await runTest('Generate colored clips and combine', async () => {
          const result = await editlyWeb({
            width: 640,
            height: 480,
            fps: 24,
            clips: [
              { duration: 1, layers: [{ type: 'fill-color', color: '#ff0000' }] },
              { duration: 1, layers: [{ type: 'linear-gradient', colors: ['#00ff00', '#0000ff'] }] },
              { duration: 1, layers: [{ type: 'radial-gradient', colors: ['#ff00ff', '#ffff00'] }] },
            ],
            sources: new Map(),
          });
          
          if (!(result instanceof Uint8Array)) throw new Error('Expected Uint8Array');
          if (result.length < 10000) throw new Error(\`Output too small: \${result.length} bytes\`);
          log(\`  Generated: \${result.length} bytes\`, 'info');
        });

        await runTest('HTMLVideoSource re-encode round-trip', async () => {
          const originalMp4 = await editlyWeb({
            width: 320,
            height: 240,
            fps: 24,
            clips: [
              { duration: 1, layers: [{ type: 'linear-gradient', colors: ['#ff0000', '#0000ff'] }] },
            ],
            sources: new Map(),
          });
          log(\`  Original: \${originalMp4.length} bytes\`, 'info');

          const buffer = new ArrayBuffer(originalMp4.byteLength);
          new Uint8Array(buffer).set(originalMp4);

          const source = await HTMLVideoSource.create({ data: buffer });
          log(\`  HTMLVideoSource: \${source.width}x\${source.height}, \${source.duration.toFixed(2)}s\`, 'info');
          
          if (source.width !== 320) throw new Error(\`Expected width 320, got \${source.width}\`);
          if (source.height !== 240) throw new Error(\`Expected height 240, got \${source.height}\`);

          const frame = await source.getFrame(0.5);
          log(\`  Frame: \${frame.codedWidth}x\${frame.codedHeight}\`, 'info');
          frame.close();
          source.close();
        });

        await runTest('Combine two videos with HTMLVideoSource', async () => {
          const video1 = await editlyWeb({
            width: 320,
            height: 240,
            fps: 24,
            clips: [{ duration: 0.5, layers: [{ type: 'fill-color', color: '#ff0000' }] }],
            sources: new Map(),
          });
          log(\`  Video 1: \${video1.length} bytes\`, 'info');

          const video2 = await editlyWeb({
            width: 320,
            height: 240,
            fps: 24,
            clips: [{ duration: 0.5, layers: [{ type: 'fill-color', color: '#0000ff' }] }],
            sources: new Map(),
          });
          log(\`  Video 2: \${video2.length} bytes\`, 'info');

          const buf1 = new ArrayBuffer(video1.byteLength);
          new Uint8Array(buf1).set(video1);
          const buf2 = new ArrayBuffer(video2.byteLength);
          new Uint8Array(buf2).set(video2);

          const sources = new Map();
          sources.set('video1.mp4', buf1);
          sources.set('video2.mp4', buf2);

          const combined = await editlyWeb({
            width: 320,
            height: 240,
            fps: 24,
            useHTMLVideo: true,
            clips: [
              { layers: [{ type: 'video', path: 'video1.mp4' }] },
              { layers: [{ type: 'video', path: 'video2.mp4' }] },
            ],
            sources,
          });

          log(\`  Combined: \${combined.length} bytes\`, 'info');
          if (combined.length < video1.length) throw new Error('Combined smaller than input');
        });

        await runTest('Videos with fade transitions', async () => {
          const result = await editlyWeb({
            width: 640,
            height: 480,
            fps: 24,
            clips: [
              { 
                duration: 1, 
                layers: [{ type: 'fill-color', color: '#ff0000' }],
                transition: { name: 'fade', duration: 0.3 }
              },
              { 
                duration: 1, 
                layers: [{ type: 'fill-color', color: '#00ff00' }],
                transition: { name: 'fade', duration: 0.3 }
              },
              { 
                duration: 1, 
                layers: [{ type: 'fill-color', color: '#0000ff' }]
              },
            ],
            sources: new Map(),
          });
          
          log(\`  With transitions: \${result.length} bytes\`, 'info');
          if (result.length < 1000) throw new Error('Output too small');
          
          const blob = new Blob([result], { type: 'video/mp4' });
          preview.src = URL.createObjectURL(blob);
        });

        await runTest('Multiple layers compositing', async () => {
          const result = await editlyWeb({
            width: 640,
            height: 480,
            fps: 24,
            clips: [
              { 
                duration: 1, 
                layers: [
                  { type: 'linear-gradient', colors: ['#1a1a2e', '#16213e'] },
                  { type: 'fill-color', color: 'rgba(255,0,0,0.5)' },
                ]
              },
            ],
            sources: new Map(),
          });
          
          log(\`  Multi-layer: \${result.length} bytes\`, 'info');
        });

        const passed = results.filter(r => r.passed).length;
        const failed = results.filter(r => !r.passed).length;
        
        log(\`\\n=== RESULTS: \${passed} passed, \${failed} failed ===\`, passed === results.length ? 'success' : 'error');
        
        window.testResults = { 
          success: failed === 0, 
          passed, 
          failed, 
          results 
        };

      } catch (err) {
        log(\`Fatal error: \${err.message}\`, 'error');
        window.testResults = { success: false, error: err.message };
      }
    }

    runTests();
  </script>
</body>
</html>`;

const server = Bun.serve({
  port: 3457,
  routes: {
    "/": videoDecodeTest,
    "/video-decode-test.html": videoDecodeTest,
    "/video-combine-test.html": new Response(videoCombineHtml, {
      headers: { "Content-Type": "text/html" },
    }),
    "/editly-bundle.js": new Response(editlyBundleJs, {
      headers: { "Content-Type": "application/javascript" },
    }),
    "/test-video.mp4": new Response(
      Bun.file(import.meta.dir + "/test-video.mp4"),
    ),
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.log(`Video test server running at http://localhost:${server.port}`);
