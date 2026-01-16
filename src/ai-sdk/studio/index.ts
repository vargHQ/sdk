import { resolve } from "node:path";
import { getCacheItemMedia, scanCacheFolder } from "./scanner";
import type { CacheItem } from "./types";

const cacheDir = process.argv[2];
if (!cacheDir) {
  console.error("usage: bun run src/ai-sdk/studio/index.ts <cache-folder>");
  process.exit(1);
}

const resolvedCacheDir = resolve(cacheDir);
console.log(`cache viewer starting...`);
console.log(`cache folder: ${resolvedCacheDir}`);

let cachedItems: CacheItem[] = [];

async function refreshCache() {
  cachedItems = await scanCacheFolder(resolvedCacheDir);
  console.log(`loaded ${cachedItems.length} items`);
}

await refreshCache();

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>cache viewer</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0a0a0a;
      color: #fafafa;
      min-height: 100vh;
    }
    header {
      padding: 1.5rem 2rem;
      border-bottom: 1px solid #222;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    header h1 { font-size: 1.25rem; font-weight: 500; }
    .stats { color: #666; font-size: 0.875rem; }
    .filters {
      padding: 1rem 2rem;
      display: flex;
      gap: 0.5rem;
    }
    .filter-btn {
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      border: 1px solid #333;
      background: transparent;
      color: #888;
      cursor: pointer;
      font-size: 0.875rem;
      transition: all 0.2s;
    }
    .filter-btn:hover { border-color: #555; color: #fff; }
    .filter-btn.active { background: #fff; color: #000; border-color: #fff; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
      padding: 1rem 2rem 2rem;
    }
    .card {
      background: #141414;
      border-radius: 0.75rem;
      overflow: hidden;
      border: 1px solid #222;
      transition: border-color 0.2s;
    }
    .card:hover { border-color: #444; }
    .card-media {
      aspect-ratio: 16/9;
      background: #000;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .card-media img, .card-media video {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .card-info {
      padding: 0.875rem;
    }
    .card-type {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
      font-weight: 500;
      text-transform: uppercase;
      margin-bottom: 0.5rem;
    }
    .card-type.image { background: #1a3a1a; color: #4ade80; }
    .card-type.video { background: #1a1a3a; color: #818cf8; }
    .card-title {
      font-size: 0.8rem;
      color: #999;
      word-break: break-all;
      line-height: 1.4;
    }
    .card-meta {
      display: flex;
      gap: 1rem;
      margin-top: 0.5rem;
      font-size: 0.75rem;
      color: #555;
    }
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4rem;
      color: #666;
    }
    .empty {
      text-align: center;
      padding: 4rem;
      color: #666;
    }
    .refresh-btn {
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      border: 1px solid #333;
      background: transparent;
      color: #888;
      cursor: pointer;
      font-size: 0.875rem;
    }
    .refresh-btn:hover { border-color: #555; color: #fff; }
    .card-media { cursor: pointer; }
    .modal {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.9);
      z-index: 1000;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    .modal.open { display: flex; }
    .modal-content {
      max-width: 90vw;
      max-height: 90vh;
      position: relative;
    }
    .modal-content img, .modal-content video {
      max-width: 90vw;
      max-height: 90vh;
      object-fit: contain;
      border-radius: 0.5rem;
    }
    .modal-close {
      position: absolute;
      top: -2.5rem;
      right: 0;
      background: none;
      border: none;
      color: #888;
      font-size: 1.5rem;
      cursor: pointer;
    }
    .modal-close:hover { color: #fff; }
    .mute-toggle {
      position: absolute;
      bottom: 1rem;
      right: 1rem;
      padding: 0.5rem 0.75rem;
      border-radius: 0.375rem;
      border: 1px solid #444;
      background: rgba(0,0,0,0.7);
      color: #fff;
      font-size: 0.75rem;
      cursor: pointer;
    }
    .mute-toggle:hover { background: rgba(0,0,0,0.9); }
  </style>
</head>
<body>
  <header>
    <h1>cache viewer</h1>
    <div style="display: flex; gap: 1rem; align-items: center;">
      <span class="stats" id="stats"></span>
      <button class="refresh-btn" onclick="refresh()">refresh</button>
    </div>
  </header>
  <div class="filters">
    <button class="filter-btn active" data-filter="all">all</button>
    <button class="filter-btn" data-filter="image">images</button>
    <button class="filter-btn" data-filter="video">videos</button>
  </div>
  <div id="grid" class="grid"></div>
  <div id="modal" class="modal" onclick="closeModal(event)">
    <div class="modal-content">
      <button class="modal-close" onclick="closeModal()">&times;</button>
      <div id="modal-media"></div>
    </div>
  </div>

  <script>
    let items = [];
    let filter = 'all';

    async function fetchItems() {
      const res = await fetch('/api/items');
      items = await res.json();
      updateStats();
      renderGrid();
    }

    function updateStats() {
      const images = items.filter(i => i.type === 'image').length;
      const videos = items.filter(i => i.type === 'video').length;
      document.getElementById('stats').textContent = 
        items.length + ' items (' + images + ' images, ' + videos + ' videos)';
    }

    function formatSize(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function formatDate(dateStr) {
      const date = new Date(dateStr);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }

    function renderGrid() {
      const grid = document.getElementById('grid');
      const filtered = filter === 'all' ? items : items.filter(i => i.type === filter);
      
      if (filtered.length === 0) {
        grid.innerHTML = '<div class="empty">no items found</div>';
        return;
      }

      grid.innerHTML = filtered.map(item => {
        const mediaUrl = '/api/media/' + encodeURIComponent(item.id);
        const mediaHtml = item.type === 'video' 
          ? '<video src="' + mediaUrl + '" muted loop preload="metadata" onmouseenter="this.play()" onmouseleave="this.pause();this.currentTime=0"></video>'
          : '<img src="' + mediaUrl + '" alt="' + item.id + '" loading="lazy">';
        
        return '<div class="card">' +
          '<div class="card-media" onclick="openModal(\\'' + item.type + '\\', \\'' + mediaUrl + '\\')">' + mediaHtml + '</div>' +
          '<div class="card-info">' +
            '<span class="card-type ' + item.type + '">' + item.type + '</span>' +
            '<div class="card-title">' + item.id + '</div>' +
            '<div class="card-meta">' +
              '<span>' + formatSize(item.size) + '</span>' +
              '<span>' + formatDate(item.createdAt) + '</span>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    function refresh() {
      fetchItems();
    }

    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filter = btn.dataset.filter;
        renderGrid();
      });
    });

    fetchItems();

    function openModal(type, url) {
      const modal = document.getElementById('modal');
      const mediaContainer = document.getElementById('modal-media');
      if (type === 'video') {
        mediaContainer.innerHTML = '<video id="modal-video" src="' + url + '" controls autoplay loop muted></video>' +
          '<button class="mute-toggle" onclick="toggleMute()">' +
            '<span id="mute-icon">muted</span>' +
          '</button>';
      } else {
        mediaContainer.innerHTML = '<img src="' + url + '">';
      }
      modal.classList.add('open');
    }

    function toggleMute() {
      const video = document.getElementById('modal-video');
      if (!video) return;
      video.muted = !video.muted;
      document.getElementById('mute-icon').textContent = video.muted ? 'muted' : 'unmuted';
    }

    function closeModal(e) {
      if (e && e.target !== e.currentTarget) return;
      const modal = document.getElementById('modal');
      modal.classList.remove('open');
      document.getElementById('modal-media').innerHTML = '';
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  </script>
</body>
</html>`;

const server = Bun.serve({
  port: 8282,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/") {
      return new Response(html, {
        headers: { "content-type": "text/html" },
      });
    }

    if (url.pathname === "/api/items") {
      await refreshCache();
      return new Response(JSON.stringify(cachedItems), {
        headers: { "content-type": "application/json" },
      });
    }

    if (url.pathname.startsWith("/api/media/")) {
      const id = decodeURIComponent(url.pathname.replace("/api/media/", ""));
      const media = await getCacheItemMedia(resolvedCacheDir, id);

      if (!media) {
        return new Response("not found", { status: 404 });
      }

      const buffer = Buffer.from(media.data, "base64");
      return new Response(buffer, {
        headers: { "content-type": media.mimeType },
      });
    }

    return new Response("not found", { status: 404 });
  },
});

console.log(`\nopen http://localhost:${server.port}`);
