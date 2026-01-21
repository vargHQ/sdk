import example from "./example.html";

const server = Bun.serve({
  port: 3457,
  routes: {
    "/": example,
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.log(`example running at http://localhost:${server.port}`);
