/* VM Projects chạy offline: giữ sẵn khung app (HTML, JS, phông chữ). Nội dung tài liệu lưu riêng trên máy (localStorage), không qua đây.
   Không bao giờ lưu yêu cầu tới api.github.com. Đổi V khi muốn ép xóa bộ nhớ đệm cũ. */
const V = "vmp-shell-9";
const SHELL = ["./", "index.html", "board.js", "nav.js", "wys.js", "vmref.js", "diagram.js", "vendor/editor.js", "vendor/marked.umd.js",
  "favicon.png", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("vmp-shell-") && k !== V).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET") return;
  if (u.origin === location.origin) {                       // khung app: lấy mạng trước (luôn có bản mới), mất mạng dùng bản lưu
    const key = r.mode === "navigate" ? "index.html" : r;
    e.respondWith(fetch(r).then(res => {
      if (res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(r.mode === "navigate" ? "index.html" : r, cp)); }
      return res;
    }).catch(() => caches.match(key, {ignoreSearch: r.mode === "navigate"})));
    return;
  }
  if (/^fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) {   // phông chữ: bản lưu trước
    e.respondWith(caches.open("vmp-fonts").then(c => c.match(r).then(hit => hit || fetch(r).then(res => { c.put(r, res.clone()); return res; }))));
  }
});
