/* Thanh bên: danh mục do người dùng tạo, đổi tên, sắp xếp; kéo thả hoặc bấm ⇄ để chuyển tệp sang danh mục khác.
   Danh mục chỉ là siêu dữ liệu lưu trong nav.json ở gốc repo (không di chuyển file thật nên link giữa các file không bị gãy).
   Trang chủ định nghĩa: window.navAdapter = { load(): cfg|null, save(cfg, message) } */
(() => {
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
const GROUPS = {"": "Chung", "projects/dunmorn": "Dunmorn", "tools": "Công cụ", "notes": "Ghi chú"};
const ORDER = ["projects/dunmorn", "", "tools", "notes"];
const N = {cfg: {order: null, files: {}}, files: [], opts: null, host: null, drag: null, cat: null};
const defCat = f => GROUPS[f.dir] ?? f.dir;
const canEdit = () => !!window.navAdapter && (typeof canWrite === "undefined" || canWrite);
let fold = {}; try { fold = JSON.parse(localStorage.getItem("vm.navfold") || "{}") || {}; } catch {}
const saveFold = () => { try { localStorage.setItem("vm.navfold", JSON.stringify(fold)); } catch {} };

function cats() {                                                   // danh sách danh mục theo thứ tự
  const out = [...(N.cfg.order || [])];
  const unassigned = N.files.filter(f => { const c = N.cfg.files[f.path]; return !(c && out.includes(c)); });   // chỉ tệp chưa được xếp danh mục mới sinh danh mục mặc định
  const derived = [...new Set(unassigned.map(defCat))].filter(c => !out.includes(c)).sort((a, b) => {
    const rk = n => { const d = Object.keys(GROUPS).find(k => GROUPS[k] === n) ?? n, i = ORDER.indexOf(d); return i < 0 ? 99 : i; };
    return rk(a) - rk(b) || a.localeCompare(b, "vi");
  });
  return out.concat(derived);
}
function catOf(f) { const c = N.cfg.files[f.path]; return c && cats().includes(c) ? c : defCat(f); }
function materialize() { const list = cats(), m = {}; N.files.forEach(f => { m[f.path] = catOf(f); }); N.cfg = {order: list, files: m}; }
let chain = Promise.resolve();
function persist(message) {
  const snap = JSON.parse(JSON.stringify(N.cfg));
  const job = chain.then(() => window.navAdapter.save(snap, message));
  chain = job.catch(() => {}); draw();
  return job.catch(e => { toast(e.message, true, 6000); return load(); });
}
async function load() {
  if (!window.navAdapter) return;
  try { const d = await window.navAdapter.load(); N.cfg = d && Array.isArray(d.order) && d.files ? {order: d.order, files: d.files} : {order: null, files: {}}; }
  catch (e) { toast(e.message, true, 5000); }
  draw();
}
function cleanName(raw, except) {
  const n = String(raw || "").trim().replace(/\s+/g, " ").slice(0, 40);
  if (!n) return "";
  if (cats().some(c => c.toLowerCase() === n.toLowerCase() && c !== except)) { toast("Đã có danh mục tên “" + n + "”.", true); return ""; }
  return n;
}
function addCat(name, then) {
  const n = cleanName(name); if (!n) return false;
  materialize(); N.cfg.order.push(n); if (then) then(n);
  persist("Thêm danh mục: " + n); return n;
}
function moveCat(name, to, after) {                                   // kéo danh mục tới trước / sau danh mục khác
  materialize(); const o = N.cfg.order.filter(c => c !== name);
  const i = o.indexOf(to); if (i < 0) return;
  o.splice(after ? i + 1 : i, 0, name); N.cfg.order = o; persist("Đổi vị trí danh mục: " + name);
}
function moveFile(path, cat) {
  const f = N.files.find(x => x.path === path); if (!f || catOf(f) === cat) return;
  materialize(); N.cfg.files[path] = cat; persist(`Chuyển ${f.title.slice(0, 40)} sang ${cat}`);
}

/* ---------------- vẽ ---------------- */
function draw(host, files, opts) {
  if (host) { N.host = host; N.files = files; N.opts = opts; }
  host = N.host; if (!host) return;
  host.innerHTML = ""; const edit = canEdit(), list = cats();
  if (edit) {
    const add = document.createElement("button"); add.className = "nav-add"; add.textContent = "＋ Danh mục mới";
    add.onclick = () => { const n = prompt("Tên danh mục mới:"); if (n) addCat(n); };
    host.appendChild(add);
  }
  for (const c of list) {
    const mine = N.files.filter(f => catOf(f) === c).sort((a, b) => (b.path.endsWith("README.md") - a.path.endsWith("README.md")) || a.title.localeCompare(b.title, "vi"));
    const g = document.createElement("section"); g.className = "cat" + (fold[c] ? " closed" : ""); g.dataset.cat = c;
    g.innerHTML = `<div class="cat-h"${edit ? ' draggable="true" title="Kéo để đổi vị trí danh mục"' : ""}><button class="cat-t" aria-expanded="${!fold[c]}"><span class="chev">▾</span><span class="cat-n">${esc(c)}</span><span class="cat-c">${mine.length}</span></button>${edit ? `<button class="cat-e" title="Đổi tên, sắp xếp, xoá danh mục" aria-label="Sửa danh mục">⋯</button>` : ""}</div><div class="cat-b"></div>`;
    g.querySelector(".cat-t").onclick = () => { fold[c] = !fold[c]; saveFold(); g.classList.toggle("closed", !!fold[c]); };
    if (edit) g.querySelector(".cat-e").onclick = () => openCat(c);
    const body = g.querySelector(".cat-b");
    if (!mine.length) body.innerHTML = `<div class="cat-empty">Trống${edit ? ": kéo tệp vào đây" : ""}</div>`;
    for (const f of mine) {
      const row = document.createElement("div"); row.className = "nrow"; row.draggable = edit; row.dataset.path = f.path;
      const b = document.createElement("button"); b.className = "item" + (N.opts.active(f.path) ? " active" : "");
      b.innerHTML = `${esc(f.title)}<small>${esc(f.path)}</small>`; b.onclick = () => N.opts.open(f.path);
      row.appendChild(b);
      if (edit) { const m = document.createElement("button"); m.className = "nmv"; m.title = "Chuyển sang danh mục khác"; m.setAttribute("aria-label", "Chuyển danh mục"); m.textContent = "⇄"; m.onclick = e => { e.stopPropagation(); openMove(f.path); }; row.appendChild(m); }
      body.appendChild(row);
    }
    host.appendChild(g);
  }
  if (!host.dataset.dnd) {                                          // kéo thả: một lần cho cả thanh bên
    host.dataset.dnd = "1";
    host.addEventListener("dragstart", e => {                     // kéo cả danh mục (bấm giữ tiêu đề)
      const h = e.target.closest && e.target.closest(".cat-h"); if (!h || e.target.closest(".nrow")) return;
      N.dragCat = h.parentElement.dataset.cat; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", N.dragCat); h.parentElement.classList.add("dragging");
    });
    host.addEventListener("dragover", e => {
      if (!N.dragCat) return; const g = e.target.closest(".cat"); if (!g) return; e.preventDefault();
      const r = g.getBoundingClientRect(), after = e.clientY > r.top + Math.min(r.height / 2, 30);
      host.querySelectorAll(".cat.drop-b,.cat.drop-a").forEach(x => x.classList.remove("drop-b", "drop-a"));
      if (g.dataset.cat !== N.dragCat) g.classList.add(after ? "drop-a" : "drop-b");
    });
    host.addEventListener("drop", e => {
      if (!N.dragCat) return; const g = e.target.closest(".cat"); if (!g) return; e.preventDefault();
      const name = N.dragCat, to = g.dataset.cat, after = g.classList.contains("drop-a"); N.dragCat = null;
      host.querySelectorAll(".drop-b,.drop-a,.dragging").forEach(x => x.classList.remove("drop-b", "drop-a", "dragging"));
      if (name === to) return; moveCat(name, to, after);
    });
    host.addEventListener("dragstart", e => { const r = e.target.closest && e.target.closest(".nrow"); if (!r) return; N.drag = r.dataset.path; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", N.drag); r.classList.add("dragging"); });
    host.addEventListener("dragover", e => { if (!N.drag || N.dragCat) return; const g = e.target.closest(".cat"); if (!g) return; e.preventDefault(); host.querySelectorAll(".cat.over").forEach(x => x !== g && x.classList.remove("over")); g.classList.add("over"); });
    host.addEventListener("drop", e => { if (!N.drag) return; const g = e.target.closest(".cat"); if (!g) return; e.preventDefault(); const p = N.drag; N.drag = null; moveFile(p, g.dataset.cat); });
    host.addEventListener("dragend", () => { N.drag = null; N.dragCat = null; host.querySelectorAll(".drop-b,.drop-a").forEach(x => x.classList.remove("drop-b", "drop-a")); host.querySelectorAll(".over,.dragging").forEach(x => x.classList.remove("over", "dragging")); });
  }
}

/* ---------------- hộp thoại ---------------- */
function dialog() {
  let d = $("#navDlg");
  if (!d) { d = document.createElement("dialog"); d.id = "navDlg"; document.body.appendChild(d); d.addEventListener("click", e => { if (e.target === d) d.close(); }); }
  return d;
}
function openMove(path) {
  const f = N.files.find(x => x.path === path), cur = catOf(f), d = dialog();
  d.innerHTML = `<div class="dl"><h3>Chuyển “${esc(f.title)}” tới</h3><div class="nav-list">${cats().map(c => `<button data-c="${esc(c)}" class="${c === cur ? "on" : ""}">${c === cur ? "✓ " : ""}${esc(c)}</button>`).join("")}<button data-new="1" class="plus">＋ Danh mục mới…</button></div>
    <div class="dl-foot"><span></span><button data-x="1">Đóng</button></div></div>`;
  d.onclick = e => {
    if (e.target === d) return d.close();
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.x) return d.close();
    if (b.dataset.new) { const n = prompt("Tên danh mục mới:"); if (n) { materialize(); const nm = cleanName(n); if (!nm) return; N.cfg.order.push(nm); N.cfg.files[path] = nm; persist(`Thêm danh mục ${nm}, chuyển ${f.title.slice(0, 40)}`); d.close(); } return; }
    moveFile(path, b.dataset.c); d.close();
  };
  d.showModal();
}
function openCat(name) {
  const d = dialog(), empty = !N.files.some(f => catOf(f) === name), i = cats().indexOf(name), n = cats().length;
  d.innerHTML = `<div class="dl"><h3>Danh mục</h3><div class="lbl">Tên</div><input class="dl-title" id="catName" value="${esc(name)}" maxlength="40">
    <div class="lbl">Thứ tự</div><div class="seg full"><button data-a="up"${i === 0 ? " disabled" : ""}>▲ Lên</button><button data-a="down"${i === n - 1 ? " disabled" : ""}>▼ Xuống</button></div>
    <div class="dl-note">${empty ? "Danh mục đang trống, có thể xoá." : "Muốn xoá danh mục, hãy chuyển hết tệp ra trước."}</div>
    <div class="dl-foot"><button class="danger" data-a="del"${empty ? "" : " disabled"}>Xoá danh mục</button><button class="primary" data-a="ok">Xong</button></div></div>`;
  const rename = () => {
    const v = d.querySelector("#catName").value; if (v.trim() === name) return name;
    const nn = cleanName(v, name); if (!nn) { d.querySelector("#catName").value = name; return name; }
    materialize(); N.cfg.order = N.cfg.order.map(c => c === name ? nn : c);
    for (const k of Object.keys(N.cfg.files)) if (N.cfg.files[k] === name) N.cfg.files[k] = nn;
    if (fold[name] !== undefined) { fold[nn] = fold[name]; delete fold[name]; saveFold(); }
    persist(`Đổi tên danh mục: ${name} → ${nn}`); name = nn; return nn;
  };
  d.querySelector("#catName").onchange = rename;
  d.querySelector("#catName").onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); rename(); d.close(); } };
  d.onclick = e => {
    if (e.target === d) { rename(); return d.close(); }
    const b = e.target.closest("button"); if (!b || b.disabled) return; const a = b.dataset.a;
    if (a === "ok") { rename(); d.close(); }
    else if (a === "up" || a === "down") { name = rename(); materialize(); const o = N.cfg.order, k = o.indexOf(name), j = k + (a === "up" ? -1 : 1); if (j >= 0 && j < o.length) { [o[k], o[j]] = [o[j], o[k]]; persist("Đổi thứ tự danh mục: " + name); } d.close(); }
    else if (a === "del") { materialize(); N.cfg.order = N.cfg.order.filter(c => c !== name); persist("Xoá danh mục: " + name); d.close(); }
  };
  d.showModal();
}

/* ---------------- tạo văn bản mới: gõ tên, chọn danh mục (hoặc tạo danh mục mới), rồi vào trình soạn thảo ---------------- */
const slug = s => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "van-ban";
function dirFor(cat) {                                              // thư mục chứa nhiều tệp nhất của danh mục; danh mục trống -> notes
  const cnt = {};
  N.files.filter(f => catOf(f) === cat).forEach(f => { const d = f.path.includes("/") ? f.path.slice(0, f.path.lastIndexOf("/")) : ""; cnt[d] = (cnt[d] || 0) + 1; });
  const best = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : "notes";
}
function pathFor(title, cat) {
  const dir = dirFor(cat), base = (dir ? dir + "/" : "") + slug(title);
  const taken = p => N.files.some(f => f.path.toLowerCase() === p.toLowerCase());
  let p = base + ".md", i = 2; while (taken(p)) p = `${base}-${i++}.md`;
  return p;
}
function newDoc() {
  if (!canEdit() || !window.navAdapter.create) { toast("Không tạo được văn bản (chỉ có quyền đọc).", true); return; }
  const d = dialog(), list = cats(), curCat = (N.opts && N.files.find(f => N.opts.active(f.path))) ? catOf(N.files.find(f => N.opts.active(f.path))) : list[0];
  d.innerHTML = `<div class="dl"><h3>Văn bản mới</h3>
    <div class="lbl">Tên văn bản</div><input class="dl-title" id="ndTitle" maxlength="120" placeholder="Ví dụ: Ý tưởng boss chương 2" autocomplete="off">
    <div class="lbl">Nằm trong danh mục</div>
    <select id="ndCat" class="nd-sel">${list.map(c => `<option value="${esc(c)}"${c === curCat ? " selected" : ""}>${esc(c)}</option>`).join("")}<option value="__new">＋ Danh mục mới…</option></select>
    <input class="dl-title nd-new hidden" id="ndNew" maxlength="40" placeholder="Tên danh mục mới" autocomplete="off">
    <div class="dl-note" id="ndPath"></div>
    <div class="dl-foot"><button data-a="x">Huỷ</button><button class="primary" data-a="ok">Tạo và soạn ›</button></div></div>`;
  const $d = s => d.querySelector(s), isNew = () => $d("#ndCat").value === "__new";
  const show = () => {
    $d("#ndNew").classList.toggle("hidden", !isNew());
    const t = $d("#ndTitle").value.trim(), cat = isNew() ? ($d("#ndNew").value.trim() || "…") : $d("#ndCat").value;
    $d("#ndPath").textContent = t ? "Lưu thành tệp: " + pathFor(t, isNew() ? "\u0000" : cat) : "Gõ tên văn bản trước.";
  };
  let busy = false;
  const submit = async () => {
    if (busy) return;
    const title = $d("#ndTitle").value.trim().replace(/\s+/g, " ");
    if (!title) { toast("Hãy gõ tên văn bản.", true); $d("#ndTitle").focus(); return; }
    let cat = $d("#ndCat").value, fresh = false;
    if (cat === "__new") { cat = cleanName($d("#ndNew").value); if (!cat) { $d("#ndNew").focus(); if (!$d("#ndNew").value.trim()) toast("Hãy gõ tên danh mục mới.", true); return; } fresh = true; }
    const path = pathFor(title, fresh ? "\u0000" : cat);
    busy = true; $d('[data-a="ok"]').disabled = true; $d('[data-a="ok"]').textContent = "Đang tạo…";
    try {
      await window.navAdapter.create(path, title);
      materialize(); if (fresh && !N.cfg.order.includes(cat)) N.cfg.order.push(cat);
      N.cfg.files[path] = cat; if (fold[cat]) { delete fold[cat]; saveFold(); }
      persist(fresh ? `Thêm danh mục ${cat}, tạo ${title.slice(0, 40)}` : `Xếp ${title.slice(0, 40)} vào ${cat}`);
      d.close();
      window.navAdapter.openNew(path);
    } catch (e) { toast(e.message, true, 6000); busy = false; $d('[data-a="ok"]').disabled = false; $d('[data-a="ok"]').textContent = "Tạo và soạn ›"; }
  };
  d.onclick = e => { if (e.target === d) return d.close(); const b = e.target.closest("button"); if (!b) return; if (b.dataset.a === "x") d.close(); else if (b.dataset.a === "ok") submit(); };
  d.oninput = show; d.onchange = () => { show(); if (isNew()) $d("#ndNew").focus(); };
  d.onkeydown = e => { if (e.key === "Enter" && e.target.tagName === "INPUT") { e.preventDefault(); submit(); } };
  show(); d.showModal(); $d("#ndTitle").focus();
}

/* ---------------- giao diện ---------------- */
const css = document.createElement("style");
css.textContent = `
.nav-add{display:block;width:calc(100% - 16px);margin:0 8px 10px;padding:7px 10px;border:1px dashed var(--line);background:none;color:var(--muted);border-radius:10px;font-size:13px;text-align:left}
.nav-add:hover{color:var(--accent);border-color:var(--accent)}
.cat{margin:0 8px 12px;border:1px solid var(--line);border-radius:12px;background:var(--panel);overflow:hidden}
.cat.over{outline:2px dashed var(--accent);outline-offset:-2px}
.cat-h[draggable=true]{cursor:grab}.cat.dragging{opacity:.4}
.cat.drop-b{box-shadow:0 -3px 0 var(--accent)}.cat.drop-a{box-shadow:0 3px 0 var(--accent)}
.cat-h{display:flex;align-items:center;background:var(--bg);border-bottom:1px solid var(--line)}
.cat.closed .cat-h{border-bottom:0}.cat.closed .cat-b{display:none}
.cat-t{flex:1;display:flex;align-items:center;gap:8px;border:0;background:none;padding:9px 10px;text-align:left;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);min-width:0}
.cat-n{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cat-t .chev{font-size:10px;transition:transform .15s}.cat.closed .chev{transform:rotate(-90deg)}
.cat-c{margin-left:auto;font-weight:500;letter-spacing:0;background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:0 7px;font-size:11px}
.cat-e{border:0;background:none;padding:6px 10px;color:var(--muted);font-size:16px;line-height:1}.cat-e:hover{color:var(--accent)}
.cat-b{padding:4px}
.cat-empty{padding:10px;font-size:12px;color:var(--muted);text-align:center}
.nrow{display:flex;align-items:stretch;border-radius:8px;position:relative}.nrow .item{flex:1;min-width:0}
.nrow.dragging{opacity:.4}
.nmv{border:0;background:none;color:var(--muted);padding:0 8px;opacity:0;font-size:14px}
.nrow:hover .nmv,.nmv:focus{opacity:1}.nmv:hover{color:var(--accent)}
@media (hover:none){.nmv{opacity:.6}}
#navDlg{border:1px solid var(--line);border-radius:12px;background:var(--panel);color:var(--ink);padding:0;width:min(380px,92vw)}
#navDlg::backdrop{background:rgba(0,0,0,.4)}
.nav-list{display:flex;flex-direction:column;gap:6px;margin:10px 0 4px;max-height:50vh;overflow:auto}
.nd-sel{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);font:inherit;font-size:16px}
.nd-new{margin-top:8px}#navDlg .dl-title{font-size:16px}
#navDlg .lbl{font-size:12px;color:var(--muted);margin:12px 0 4px}#navDlg .dl{padding:18px 20px}#navDlg h3{margin:0 0 4px}
#navDlg .dl-note{font-size:12px;color:var(--muted);margin-top:10px;word-break:break-all}
#navDlg .dl-foot{display:flex;justify-content:space-between;gap:8px;margin-top:18px}
.nav-list button{text-align:left;padding:8px 12px}.nav-list button.on{background:var(--accent-soft);color:var(--accent);border-color:var(--accent)}.nav-list .plus{color:var(--accent);border-style:dashed}`;
document.head.appendChild(css);

window.VMNav = {draw, load, newDoc};
})();
