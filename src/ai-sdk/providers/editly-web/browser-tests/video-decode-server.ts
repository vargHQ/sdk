const server = Bun.serve({
  port: 3457,
  async fetch(req) {
    const url = new URL(req.url);
    const path =
      url.pathname === "/" ? "/video-decode-test.html" : url.pathname;
    const file = Bun.file(import.meta.dir + path);

    if (await file.exists()) {
      return new Response(file, {
        headers: {
          "Content-Type": file.type,
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(
  `Video decode test server running at http://localhost:${server.port}`,
);
