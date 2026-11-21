/* Nhúng bảng / sơ đồ VM Ref vào tài liệu (2026-11-21, chủ nhà: "nhúng bảng từ VM Ref, sửa trong VM Projects cũng ảnh hưởng y hệt sửa trên VM Ref").
   Markdown chỉ là một ảnh thường:  ![VM Ref: tên bảng](../assets/vmref-<mã bảng>.png "vmref:<mã bảng>")
   - Ảnh đó là ẢNH CHỤP LẦN CUỐI của bảng (dùng khi offline / không tới được mini PC, và đọc được cả trên GitHub).
   - Khi xem tài liệu mà tới được mini PC: hiện chính bảng VM Ref (iframe <VM Ref>/?embed=<mã>), sửa ở đây = sửa thẳng trên VM Ref (một bản dùng chung).
   - Mỗi lần bảng đổi, VM Ref gửi ảnh chụp mới (postMessage) -> trang chủ ghi đè assets/vmref-<mã>.png (wysHooks / vmrefHooks.saveSnap).
   Trang chủ định nghĩa window.vmrefHooks = { saveSnap(board, blob) -> Promise, canSave() -> bool }.
   Địa chỉ VM Ref: localStorage "vmprojects.vmref" (mặc định link https Tailscale của mini PC). */
(() => {
const DEF = "https://vmminipc-1.tail0f6e99.ts.net:8455";
const base = () => { try { return (localStorage.getItem("vmprojects.vmref") || DEF).replace(/\/+$/, ""); } catch { return DEF; } };
const origin = () => { try { return new URL(base()).origin; } catch { return ""; } };
const hooks = () => window.vmrefHooks || {};
const frames = new WeakMap();        // contentWindow của khung -> {w, board, st, timer}
let pickRes = null;

function asset(board) { return "assets/vmref-" + board + ".png"; }
function markdown(board, name, rel) { return `![VM Ref: ${(name || "bảng").replace(/[\[\]]/g, "")}](${rel(asset(board))} "vmref:${board}")`; }

/* trong trang xem: thay ảnh có title "vmref:<mã>" bằng bảng VM Ref thật */
function decorate(el) {
  el.querySelectorAll('img[title^="vmref:"]').forEach(img => {
    const board = img.getAttribute("title").slice(6).replace(/[^a-z0-9]/gi, ""); if (!board) return;
    const name = (img.getAttribute("alt") || "").replace(/^VM Ref:\s*/, "") || "Bảng VM Ref";
    const host = img.closest("p") && img.closest("p").childNodes.length === 1 ? img.closest("p") : img;
    const w = document.createElement("div"); w.className = "vr"; w.dataset.board = board;
    w.innerHTML = `<div class="vr-bar"><span class="vr-ic">▦</span><b></b><span class="vr-st">Đang mở bảng trên mini PC…</span>
      <button type="button" class="vr-full" title="Toàn màn hình">⤢</button><a class="vr-open" target="_blank" rel="noopener" title="Mở trong VM Ref">↗</a></div>
      <div class="vr-body"><div class="vr-fb"></div><iframe allow="clipboard-read; clipboard-write; fullscreen" referrerpolicy="no-referrer" title="Bảng VM Ref"></iframe>
      <button type="button" class="vr-cover"><span>Bấm để sửa bảng</span></button></div>`;
    w.querySelector("b").textContent = name;
    const fb = w.querySelector(".vr-fb"); img.removeAttribute("title"); img.onclick = null; fb.appendChild(img);
    host.replaceWith(w);
    const fr = w.querySelector("iframe"), url = base() + "/?embed=" + encodeURIComponent(board);
    w.querySelector(".vr-open").href = base() + "/?board=" + encodeURIComponent(board);
    w.querySelector(".vr-cover").onclick = () => w.classList.add("act");
    w.querySelector(".vr-full").onclick = () => { w.classList.toggle("full"); w.classList.add("act"); document.body.classList.toggle("vr-lock", w.classList.contains("full")); };
    const st = w.querySelector(".vr-st");
    const timer = setTimeout(() => { if (!w.classList.contains("live")) { st.textContent = "Chưa tới được mini PC — đang xem ảnh chụp lần cuối"; w.classList.add("off"); } }, 15000);
    if (fr.contentWindow) frames.set(fr.contentWindow, {w, board, st, timer});
    fr.src = url;
  });
}
addEventListener("keydown", e => { if (e.key === "Escape") { const f = document.querySelector(".vr.full"); if (f) { f.classList.remove("full"); document.body.classList.remove("vr-lock"); } } });

const pend = new Map();              // board -> {blob, sig, t}
const sigKey = b => "vmprojects.vrsig." + b;
function queueSnap(board, png, sig) {
  if (!png || !hooks().saveSnap) return;
  try { if (sig && localStorage.getItem(sigKey(board)) === sig) return; } catch {}
  const p = pend.get(board) || {}; clearTimeout(p.t);
  p.png = png; p.sig = sig; p.t = setTimeout(() => flush(board), 6000); pend.set(board, p);
}
async function flush(board) {
  const p = pend.get(board); if (!p) return; pend.delete(board);
  if (hooks().canSave && !hooks().canSave()) return;
  try {
    const blob = await (await fetch(p.png)).blob();
    await hooks().saveSnap(board, blob);
    try { if (p.sig) localStorage.setItem(sigKey(board), p.sig); } catch {}
  } catch (e) { console.warn("vmref snap", e); }
}
addEventListener("pagehide", () => { for (const b of [...pend.keys()]) flush(b); });

addEventListener("message", e => {
  if (e.origin !== origin()) return;
  const m = e.data || {}; if (!m.vmref) return;
  if (m.vmref === "pick" && pickRes) { const r = pickRes; pickRes = null; closePick(); r({board: m.board, name: m.name}); return; }
  const f = frames.get(e.source); if (!f) return;
  if (m.vmref === "ready") {
    clearTimeout(f.timer); f.w.classList.add("live"); f.w.classList.remove("off"); f.st.textContent = "Đang sửa trực tiếp trên VM Ref";
    if (m.name) f.w.querySelector("b").textContent = m.name;
  } else if (m.vmref === "missing") {
    clearTimeout(f.timer); f.w.classList.add("off"); f.st.textContent = "Bảng này không còn trên VM Ref — đang xem ảnh chụp lần cuối";
  } else if (m.vmref === "snap" && m.board === f.board) {
    if (m.name) f.w.querySelector("b").textContent = m.name;
    queueSnap(f.board, m.png, m.sig);
  }
});

/* chọn bảng có sẵn hoặc tạo bảng sơ đồ mới (trang chọn của VM Ref trong khung) */
function closePick() { const d = document.getElementById("vrPick"); if (d) d.remove(); }
function pick() {
  closePick();
  return new Promise(res => {
    pickRes = res;
    const d = document.createElement("div"); d.id = "vrPick";
    d.innerHTML = `<div class="vr-dlg"><div class="vr-dh"><b>Nhúng bảng / sơ đồ VM Ref</b><button type="button" class="vr-x" title="Đóng">✕</button></div>
      <iframe referrerpolicy="no-referrer" title="Chọn bảng VM Ref"></iframe>
      <div class="vr-dn">Chưa hiện danh sách? Cần bật Tailscale để tới được mini PC. Địa chỉ VM Ref: <code></code> <button type="button" class="vr-url">Đổi…</button></div></div>`;
    d.querySelector("code").textContent = base();
    d.querySelector(".vr-x").onclick = () => { pickRes = null; closePick(); res(null); };
    d.querySelector(".vr-url").onclick = () => {
      const v = prompt("Địa chỉ VM Ref (link https Tailscale của mini PC):", base()); if (!v) return;
      try { localStorage.setItem("vmprojects.vmref", v.trim()); } catch {}
      d.querySelector("code").textContent = base(); d.querySelector("iframe").src = base() + "/?pick=1";
    };
    document.body.appendChild(d);
    d.querySelector("iframe").src = base() + "/?pick=1";
  });
}

const css = document.createElement("style");
css.textContent = `
.vr{margin:16px 0;border:1px solid var(--line,#ddd);border-radius:12px;overflow:hidden;background:#1b1b1d}
.vr-bar{display:flex;align-items:center;gap:8px;padding:6px 8px 6px 12px;background:var(--panel,#f4f4f6);color:var(--text,#222);font-size:13px}
.vr-bar b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:45%}
.vr-st{color:var(--muted,#888);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px}
.vr-bar button,.vr-bar a{border:1px solid var(--line,#ccc);background:transparent;color:inherit;border-radius:7px;padding:2px 9px;font-size:15px;cursor:pointer;text-decoration:none;line-height:1.4}
.vr-body{position:relative;height:min(560px,70vh);resize:vertical;overflow:hidden;min-height:220px}
.vr-fb{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#1b1b1d}
.vr-fb img{max-width:100%;max-height:100%;object-fit:contain;border-radius:0!important;margin:0!important;cursor:default}
.vr-fb em{color:#999;font-size:13px}
.vr iframe{position:absolute;inset:0;width:100%;height:100%;border:0;visibility:hidden;background:#1b1b1d}
.vr.live iframe{visibility:visible}.vr.live .vr-fb{display:none}
.vr-cover{position:absolute;inset:0;border:0;background:transparent;cursor:pointer;display:none;align-items:flex-end;justify-content:center;padding-bottom:12px}
.vr.live:not(.act) .vr-cover{display:flex}
.vr-cover span{background:rgba(0,0,0,.65);color:#fff;font-size:13px;padding:6px 12px;border-radius:999px;opacity:.85}
.vr.full{position:fixed;inset:0;z-index:2000;margin:0;border-radius:0;display:flex;flex-direction:column}
.vr.full .vr-body{flex:1;height:auto;resize:none}
body.vr-lock{overflow:hidden}
#vrPick{position:fixed;inset:0;z-index:2100;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:12px}
#vrPick .vr-dlg{width:min(520px,100%);height:min(640px,100%);background:#1b1b1d;border-radius:14px;overflow:hidden;display:flex;flex-direction:column;color:#e8e8ea}
#vrPick .vr-dh{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid #333}
#vrPick .vr-x,#vrPick .vr-url{background:none;border:1px solid #444;color:inherit;border-radius:7px;padding:2px 9px;cursor:pointer}
#vrPick iframe{flex:1;border:0;width:100%}
#vrPick .vr-dn{font-size:12px;color:#9a9aa4;padding:8px 12px;border-top:1px solid #333}
#vrPick code{font-size:11px;word-break:break-all}
img.vmref-img{outline:2px dashed #4da3ff;outline-offset:3px}`;
document.head.appendChild(css);

window.VMRef = {decorate, pick, markdown, asset, base};
})();
