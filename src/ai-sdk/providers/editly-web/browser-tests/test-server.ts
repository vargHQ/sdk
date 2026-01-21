import testHtml from "./test.html";

Bun.serve({
  port: 3456,
  routes: {
    "/": testHtml,
    "/media/*": async (req) => {
      const path = new URL(req.url).pathname.replace("/media/", "");
      const file = Bun.file(`media/${path}`);
      if (await file.exists()) {
        return new Response(file);
      }
      return new Response("Not found", { status: 404 });
    },
    "/output/*": async (req) => {
      const path = new URL(req.url).pathname.replace("/output/", "");
      const file = Bun.file(`output/${path}`);
      if (await file.exists()) {
        return new Response(file);
      }
      return new Response("Not found", { status: 404 });
    },
  },
  development: false,
});

console.log("Test server running on http://localhost:3456");
