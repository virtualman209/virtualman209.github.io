/* Bảng việc: tiến độ, kanban và lịch. Dùng chung cho bản chạy trên máy và bản online.
   Đọc mọi checklist (- [ ] việc) trong các file .md, ghi lại ngay trên chính dòng đó.
   Quy ước trên dòng:  📅 YYYY-MM-DD = hạn,  #doing = đang làm,  [x] = xong.
   Trang chủ phải định nghĩa trước: window.boardAdapter = { list(), update(path, line, expected, newLine, message) } */
(() => {
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
const DUE_RE = /\s*📅\s*(\d{4}-\d{2}-\d{2})/, DOING_RE = /\s*#doing\b/i;
const TASK_RE = /^(\s*)([-*+])\s+\[([ xX])\]\s+(.*)$/;
const STATUS = [["todo", "Cần làm"], ["doing", "Đang làm"], ["done", "Xong"]];
const VERB = {todo: "Mở lại", doing: "Đang làm", done: "Xong"};
const gname = d => (typeof GROUPS !== "undefined" && GROUPS[d]) || d || "Chung";

/* ---------------- ngày tháng (chuỗi YYYY-MM-DD, theo giờ máy) ---------------- */
const pad = n => String(n).padStart(2, "0");
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const addDays = (s, n) => { const [y, m, d] = s.split("-").map(Number); return ymd(new Date(y, m - 1, d + n)); };
const fmt = s => { const [y, m, d] = s.split("-"); return `${d}/${m}` + (+y !== new Date().getFullYear() ? "/" + y : ""); };
function dueClass(due, done) {
  if (!due || done) return "";
  const t = today(); return due < t ? "bad" : due <= addDays(t, 7) ? "soon" : "";
}

/* ---------------- tách việc từ các file ---------------- */
const clean = s => s.replace(/\*\*|`|~~/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").trim();
const phaseName = s => clean(s).replace(/^\d+\.\s*/, "").replace(/\s*\([^)]*\)\s*$/, "").trim();
const statusOf = t => t.done ? "done" : t.doing ? "doing" : "todo";
function parseDocs(docs) {
  const out = []; let order = 0;
  for (const d of docs) {
    let fence = false, h1 = "", h2 = "", h3 = "";
    d.text.split("\n").forEach((l, i) => {
      if (/^\s*(```|~~~)/.test(l)) { fence = !fence; return; }
      if (fence) return;
      const cr = l.endsWith("\r"), line = cr ? l.slice(0, -1) : l;
      let m = /^(#{1,3})\s+(.+?)\s*$/.exec(line);
      if (m) { if (m[1] === "#") { h1 = m[2]; h2 = h3 = ""; } else if (m[1] === "##") { h2 = m[2]; h3 = ""; } else h3 = m[2]; return; }
      m = TASK_RE.exec(line); if (!m) return;
      const text = m[4], due = (DUE_RE.exec(text) || [])[1] || "";
      const title = text.replace(DUE_RE, "").replace(DOING_RE, "").trim();
      const phase = phaseName(h2 || h1 || d.title);
      out.push({key: d.path + ":" + i, path: d.path, line: i, raw: l, cr, indent: m[1], bullet: m[2],
        done: m[3] !== " ", doing: DOING_RE.test(text), due, title, label: clean(title),
        file: d.title, phase, section: phaseName(h3), pk: d.path + "|" + phase, order: order++});
    });
  }
  return out;
}

/* ---------------- trạng thái ---------------- */
const S = {tasks: [], view: "kanban", file: "", phase: "", month: new Date(), sel: today(), moreDone: false, open: null, busy: false};
S.month = new Date(S.month.getFullYear(), S.month.getMonth(), 1);
const A = () => window.boardAdapter;
const canEdit = () => typeof canWrite === "undefined" || canWrite;
const byKey = k => S.tasks.find(t => t.key === k);
const cmp = (a, b) => ((a.due || "9999") < (b.due || "9999") ? -1 : (a.due || "9999") > (b.due || "9999") ? 1 : a.order - b.order);
const visible = () => S.tasks.filter(t => (!S.file || t.path === S.file) && (!S.phase || t.pk === S.phase));

let chain = Promise.resolve();
function change(t, patch) {                                          // patch: {status?, due?}
  if (!canEdit()) { toast("Token chỉ có quyền đọc, không sửa được.", true); return Promise.resolve(); }
  const status = patch.status ?? statusOf(t), due = "due" in patch ? patch.due : t.due;
  const line = `${t.indent}${t.bullet} [${status === "done" ? "x" : " "}] ${t.title}${due ? " 📅 " + due : ""}${status === "doing" ? " #doing" : ""}${t.cr ? "\r" : ""}`;
  if (line === t.raw) return Promise.resolve();
  const msg = `${VERB[status]}: ${t.label.slice(0, 60)}` + (due !== t.due ? ` (hạn ${due || "bỏ"})` : "");
  const job = chain.then(async () => {
    await A().update(t.path, t.line, t.raw, line, msg);
    t.raw = line; t.done = status === "done"; t.doing = status === "doing"; t.due = due;
    draw();
  });
  chain = job.catch(() => {});
  return job.catch(async e => { toast(e.message, true, 7000); await load(); });
}

/* ---------------- vẽ giao diện ---------------- */
function cardHtml(t) {
  const st = statusOf(t), cls = dueClass(t.due, t.done), ro = canEdit() ? "" : " disabled";
  return `<div class="card ${st}" draggable="true" data-k="${esc(t.key)}">
    <button class="c-title" data-act="open">${esc(t.label)}</button>
    <div class="c-meta">${esc(t.phase)}${t.section ? " › " + esc(t.section) : ""}${!S.file && fileCount() > 1 ? " · " + esc(t.file) : ""}</div>
    <div class="c-foot">
      <button class="mv" data-act="mv" data-d="-1" title="Chuyển sang cột trước"${st === "todo" ? " disabled" : ro}>◀</button>
      <button class="mv" data-act="mv" data-d="1" title="Chuyển sang cột sau"${st === "done" ? " disabled" : ro}>▶</button>
      ${t.done && !t.due ? "" : `<label class="due-edit ${cls}" title="Hạn chót">📅 <input type="date" data-act="due" value="${t.due}"${ro}></label>`}
      <button class="mv" data-act="doc" title="Mở trong tài liệu">↗</button>
    </div></div>`;
}
const fileCount = () => new Set(S.tasks.map(t => t.path)).size;

function kanbanHtml(list) {
  return `<div class="kanban">` + STATUS.map(([st, name]) => {
    let items = list.filter(t => statusOf(t) === st).sort(cmp), more = 0;
    if (st === "done" && !S.moreDone && items.length > 8) { more = items.length - 8; items = items.slice(0, 8); }
    return `<section class="col" data-col="${st}"><h3>${name} <span>${list.filter(t => statusOf(t) === st).length}</span></h3>
      <div class="list">${items.map(cardHtml).join("") || `<div class="none">Trống</div>`}
      ${more ? `<button class="link" data-act="moredone">Hiện thêm ${more} việc đã xong</button>` : ""}</div></section>`;
  }).join("") + `</div>`;
}

function chipHtml(t) {
  const cls = t.done ? "done" : t.doing ? "doing" : dueClass(t.due, t.done) === "bad" ? "bad" : "";
  return `<div class="dchip ${cls}" role="button" tabindex="0" draggable="true" data-k="${esc(t.key)}" data-act="open" title="${esc(t.label)}">${esc(t.label)}</div>`;
}
function calHtml(list) {
  const y = S.month.getFullYear(), m = S.month.getMonth(), t0 = today();
  const start = new Date(y, m, 1 - ((new Date(y, m, 1).getDay() + 6) % 7));       // tuần bắt đầu từ thứ Hai
  const days = Array.from({length: 42}, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  const n = days.slice(35).every(d => d.getMonth() !== m) ? 35 : 42;
  const by = {}; list.filter(t => t.due).sort(cmp).forEach(t => (by[t.due] = by[t.due] || []).push(t));
  const cells = days.slice(0, n).map(d => {
    const k = ymd(d), items = by[k] || [];
    return `<div class="day${d.getMonth() !== m ? " out" : ""}${k === t0 ? " today" : ""}${k === S.sel ? " sel" : ""}" data-day="${k}">
      <div class="dn">${d.getDate()}</div>${items.slice(0, 3).map(chipHtml).join("")}${items.length > 3 ? `<div class="more">+${items.length - 3}</div>` : ""}</div>`;
  }).join("");
  const selItems = (by[S.sel] || []);
  const late = list.filter(t => !t.done && t.due && t.due < t0).sort(cmp);
  const free = list.filter(t => !t.done && !t.due).sort(cmp);
  return `<div class="cal-head"><button data-act="mprev" aria-label="Tháng trước">◀</button>
      <b>Tháng ${m + 1}/${y}</b><button data-act="mnext" aria-label="Tháng sau">▶</button><button data-act="mtoday">Hôm nay</button></div>
    <div class="cal">${["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map(x => `<div class="dow">${x}</div>`).join("")}${cells}</div>
    <h4 class="sub">Việc có hạn ngày ${fmt(S.sel)} (${selItems.length})</h4>
    <div class="cards">${selItems.map(cardHtml).join("") || `<div class="none">Không có việc nào. Kéo một việc vào ngày này để đặt hạn.</div>`}</div>
    ${late.length ? `<h4 class="sub bad">Quá hạn (${late.length})</h4><div class="pool">${late.map(chipHtml).join("")}</div>` : ""}
    <h4 class="sub">Chưa có hạn (${free.length}): kéo vào một ngày trên lịch để đặt hạn</h4>
    <div class="pool">${free.slice(0, 60).map(chipHtml).join("") || `<div class="none">Mọi việc đều đã có hạn.</div>`}${free.length > 60 ? `<div class="more">… và ${free.length - 60} việc nữa</div>` : ""}</div>`;
}

function phasesOf() {                                               // tiến độ theo giai đoạn
  const map = new Map();
  S.tasks.filter(t => !S.file || t.path === S.file).forEach(t => {
    if (!map.has(t.pk)) map.set(t.pk, {pk: t.pk, name: t.phase, file: t.file, total: 0, done: 0});
    const p = map.get(t.pk); p.total++; if (t.done) p.done++;
  });
  return [...map.values()];
}
function draw() {
  const root = $("#board"); if (!root || root.classList.contains("hidden")) return;
  const all = S.tasks.filter(t => !S.file || t.path === S.file), list = visible(), t0 = today();
  const done = all.filter(t => t.done).length, pct = all.length ? Math.round(100 * done / all.length) : 0;
  const late = all.filter(t => !t.done && t.due && t.due < t0).length;
  const soon = all.filter(t => !t.done && t.due && t.due >= t0 && t.due <= addDays(t0, 7)).length;
  const doing = all.filter(t => !t.done && t.doing).length;
  const files = [...new Map(S.tasks.map(t => [t.path, t.file])).entries()];
  const scrollTop = root.scrollTop;
  root.innerHTML = `<div class="b-top">
    <div class="b-row">
      <div class="seg"><button data-act="view" data-v="kanban" class="${S.view === "kanban" ? "on" : ""}">Kanban</button><button data-act="view" data-v="cal" class="${S.view === "cal" ? "on" : ""}">Lịch</button></div>
      <select id="bFile" aria-label="Lọc theo tài liệu"><option value="">Tất cả tài liệu</option>${files.map(([p, t]) => `<option value="${esc(p)}"${p === S.file ? " selected" : ""}>${esc(t)}</option>`).join("")}</select>
      <button data-act="reload" title="Tải lại từ nguồn">↻ Tải lại</button>
      ${S.phase ? `<button data-act="clearphase">Bỏ lọc giai đoạn ✕</button>` : ""}
    </div>
    <div class="b-row sum"><div class="bar2"><i style="width:${pct}%"></i></div><b>${pct}%</b><span>${done}/${all.length} việc đã xong</span>
      ${late ? `<span class="chip due bad">Quá hạn ${late}</span>` : ""}${soon ? `<span class="chip due soon">Hạn trong 7 ngày ${soon}</span>` : ""}${doing ? `<span class="chip doing">Đang làm ${doing}</span>` : ""}</div>
    <div class="phases">${phasesOf().map(p => `<button class="ph${p.pk === S.phase ? " on" : ""}" data-act="phase" data-pk="${esc(p.pk)}" title="Bấm để chỉ xem giai đoạn này">
      <span class="pn">${esc(p.name)}</span><span class="pc">${p.done}/${p.total}</span><span class="track"><i style="width:${p.total ? 100 * p.done / p.total : 0}%"></i></span></button>`).join("")}</div>
  </div><div class="b-body">${S.tasks.length ? (S.view === "kanban" ? kanbanHtml(list) : calHtml(list))
    : `<div class="none big">Chưa có checklist nào. Thêm dòng dạng <code>- [ ] việc cần làm 📅 2026-12-31</code> vào một file .md.</div>`}</div>`;
  root.scrollTop = scrollTop;
  if (S.open) renderDialog();
}

/* ---------------- hộp chỉnh sửa một việc ---------------- */
function dlg() {
  let d = $("#bDlg");
  if (!d) { d = document.createElement("dialog"); d.id = "bDlg"; document.body.appendChild(d); d.addEventListener("close", () => { S.open = null; }); }
  return d;
}
function renderDialog() {
  const t = byKey(S.open), d = dlg(); if (!t) { if (d.open) d.close(); return; }
  const st = statusOf(t), ro = canEdit() ? "" : " disabled";
  d.innerHTML = `<div class="dl"><h3>${esc(t.label)}</h3><div class="c-meta">${esc(t.file)} › ${esc(t.phase)}${t.section ? " › " + esc(t.section) : ""}</div>
    <div class="seg full">${STATUS.map(([k, n]) => `<button data-act="dst" data-st="${k}" class="${st === k ? "on" : ""}"${ro}>${n}</button>`).join("")}</div>
    <label class="dl-row">Hạn chót <input type="date" data-act="ddue" value="${t.due}"${ro}> <button data-act="dclear"${ro}>Xoá hạn</button></label>
    <div class="dl-foot"><button data-act="ddoc">Mở trong tài liệu ↗</button><button class="primary" data-act="dclose">Đóng</button></div></div>`;
  if (!d.open) d.showModal();
}

/* ---------------- sự kiện ---------------- */
function bind() {
  const root = $("#board");
  root.addEventListener("click", e => {
    const el = e.target.closest("[data-act]"); if (!el) { const day = e.target.closest(".day"); if (day) { S.sel = day.dataset.day; draw(); } return; }
    const act = el.dataset.act, card = el.closest("[data-k]"), t = card && byKey(card.dataset.k);
    if (act === "view") { S.view = el.dataset.v; draw(); }
    else if (act === "reload") load();
    else if (act === "phase") { S.phase = S.phase === el.dataset.pk ? "" : el.dataset.pk; draw(); }
    else if (act === "clearphase") { S.phase = ""; draw(); }
    else if (act === "moredone") { S.moreDone = true; draw(); }
    else if (act === "mprev" || act === "mnext") { S.month = new Date(S.month.getFullYear(), S.month.getMonth() + (act === "mprev" ? -1 : 1), 1); draw(); }
    else if (act === "mtoday") { const n = new Date(); S.month = new Date(n.getFullYear(), n.getMonth(), 1); S.sel = today(); draw(); }
    else if (act === "open" && t) { S.open = t.key; renderDialog(); }
    else if (act === "mv" && t) { const i = STATUS.findIndex(s => s[0] === statusOf(t)) + +el.dataset.d; if (STATUS[i]) change(t, {status: STATUS[i][0]}); }
    else if (act === "doc" && t) openDoc(t);
  });
  root.addEventListener("change", e => {
    if (e.target.id === "bFile") { S.file = e.target.value; S.phase = ""; draw(); return; }
    const el = e.target.closest('[data-act="due"]'); if (!el) return;
    const t = byKey(el.closest("[data-k]").dataset.k); if (t) change(t, {due: el.value});
  });
  root.addEventListener("keydown", e => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches(".dchip")) { e.preventDefault(); S.open = e.target.dataset.k; renderDialog(); }
  });
  /* kéo thả (máy tính): thả vào cột để đổi trạng thái, thả vào ngày để đặt hạn */
  let drag = null;
  root.addEventListener("dragstart", e => {
    const el = e.target.closest("[data-k]"); if (!el) return;
    drag = el.dataset.k; e.dataTransfer.setData("text/plain", drag); e.dataTransfer.effectAllowed = "move";
  });
  root.addEventListener("dragend", () => { drag = null; root.querySelectorAll(".over").forEach(x => x.classList.remove("over")); });
  root.addEventListener("dragover", e => {
    const z = e.target.closest(".col,.day"); if (!z || !drag) return;
    e.preventDefault(); root.querySelectorAll(".over").forEach(x => x !== z && x.classList.remove("over")); z.classList.add("over");
  });
  root.addEventListener("drop", e => {
    const z = e.target.closest(".col,.day"); if (!z || !drag) return;
    e.preventDefault(); z.classList.remove("over");
    const t = byKey(drag); drag = null; if (!t) return;
    if (z.dataset.col) change(t, {status: z.dataset.col}); else { S.sel = z.dataset.day; change(t, {due: z.dataset.day}); }
  });
  dlg().addEventListener("click", e => {
    const el = e.target.closest("[data-act]"), t = byKey(S.open); if (!el || !t) { if (e.target === dlg()) dlg().close(); return; }
    const act = el.dataset.act;
    if (act === "dclose") dlg().close();
    else if (act === "dst") change(t, {status: el.dataset.st});
    else if (act === "dclear") change(t, {due: ""});
    else if (act === "ddoc") { dlg().close(); openDoc(t); }
  });
  dlg().addEventListener("change", e => { const t = byKey(S.open); if (t && e.target.dataset.act === "ddue") change(t, {due: e.target.value}); });
}
function openDoc(t) { hide(); window.go(t.path, t.label); }

/* ---------------- tải dữ liệu, hiện / ẩn ---------------- */
async function load() {
  const root = $("#board");
  if (!S.tasks.length) root.innerHTML = `<div class="none big">Đang tải việc…</div>`;
  try { S.tasks = parseDocs(await A().list()); }
  catch (e) { toast(e.message, true, 6000); root.innerHTML = `<div class="none big">${esc(e.message)}</div>`; return; }
  if (!S.init) { S.init = true; const plan = S.tasks.find(t => /(^|\/)plan\.md$/.test(t.path)); if (plan) S.file = plan.path; }   // lần đầu: xem kế hoạch chính
  if (S.file && !S.tasks.some(t => t.path === S.file)) S.file = "";
  if (S.phase && !S.tasks.some(t => t.pk === S.phase)) S.phase = "";
  draw();
}
async function show() {
  if (editing && dirty && !confirm("Bạn có thay đổi chưa lưu. Bỏ qua?")) return;
  setEditing(false); cur = null; drawNav();
  $("#viewScroll").classList.add("hidden"); $("#editBtn").classList.add("hidden"); $("#progress").classList.add("hidden");
  $("#board").classList.remove("hidden"); $("#crumb").textContent = "Bảng việc";
  $("#boardBtn").classList.add("active");
  if (location.hash.slice(1) !== "board") history.replaceState(null, "", "#board");
  await load();
}
function hide() { $("#board").classList.add("hidden"); $("#boardBtn").classList.remove("active"); if (dlg().open) dlg().close(); }

/* ---------------- hiện hạn / trạng thái trong tài liệu ---------------- */
function decorate(el) {
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), nodes = [];
  while (w.nextNode()) nodes.push(w.currentNode);
  for (const n of nodes) {
    if (!/📅\s*\d{4}-\d{2}-\d{2}|#doing\b/i.test(n.nodeValue) || n.parentElement.closest("pre,code")) continue;
    const done = !!n.parentElement.closest("li.task.done"), frag = document.createDocumentFragment(), re = /\s*(?:📅\s*(\d{4}-\d{2}-\d{2})|#doing\b)/gi;
    let last = 0, m; const v = n.nodeValue;
    while ((m = re.exec(v))) {
      frag.append(v.slice(last, m.index), " ");
      const s = document.createElement("span");
      if (m[1]) { s.className = "chip due " + dueClass(m[1], done); s.textContent = "📅 " + fmt(m[1]); } else { s.className = "chip doing"; s.textContent = "Đang làm"; }
      frag.append(s); last = re.lastIndex;
    }
    frag.append(v.slice(last)); n.replaceWith(frag);
  }
}

/* ---------------- giao diện ---------------- */
const css = document.createElement("style");
css.textContent = `
:root{--bad:#c2372d;--bad-soft:#fbe4e1}
@media (prefers-color-scheme:dark){:root{--bad:#ff8a80;--bad-soft:#3d1f1c}}
.board{flex:1;min-height:0;overflow:auto}
.b-top{padding:14px 24px 12px;border-bottom:1px solid var(--line);background:var(--panel);display:flex;flex-direction:column;gap:12px}
.b-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.b-top select{padding:6px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);font:inherit;max-width:100%}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden}
.seg button{border:0;border-radius:0;background:none}.seg button.on{background:var(--accent-soft);color:var(--accent);font-weight:500}
.seg.full{display:flex;margin:12px 0}.seg.full button{flex:1}
.sum{font-size:13px;color:var(--muted)}.sum b{color:var(--ink)}
.bar2{width:160px;height:8px;border-radius:9px;background:var(--line);overflow:hidden}.bar2 i{display:block;height:100%;background:var(--ok)}
.chip{display:inline-block;padding:0 8px;border-radius:999px;font-size:12px;line-height:20px;white-space:nowrap}
.chip.due{background:var(--bg);border:1px solid var(--line);color:var(--muted)}
.chip.due.soon{background:var(--warn-soft);border-color:transparent;color:var(--warn)}
.chip.due.bad{background:var(--bad-soft);border-color:transparent;color:var(--bad)}
.chip.doing{background:var(--accent-soft);color:var(--accent)}
.phases{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px}
.ph{display:grid;grid-template-columns:1fr auto;gap:2px 8px;text-align:left;padding:7px 10px;background:var(--bg);font-size:12px;line-height:1.35}
.ph.on{border-color:var(--accent);background:var(--accent-soft)}.ph .pn{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ph .pc{color:var(--muted);font-variant-numeric:tabular-nums}
.ph .track{grid-column:1/-1;height:5px;border-radius:9px;background:var(--line);overflow:hidden}.ph .track i{display:block;height:100%;background:var(--ok)}
.b-body{padding:16px 24px 60px}
.kanban{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;align-items:start}
.col{background:var(--panel);border:1px solid var(--line);border-radius:10px;min-height:140px}
.col h3{margin:0;padding:10px 14px;font-size:14px;border-bottom:1px solid var(--line)}.col h3 span{color:var(--muted);font-weight:400;margin-left:4px}
.col[data-col=doing] h3{color:var(--warn)}.col[data-col=done] h3{color:var(--ok)}
.col .list{padding:6px;max-height:68vh;overflow:auto}
.col.over,.day.over{outline:2px dashed var(--accent);outline-offset:-3px}
.card{border:1px solid var(--line);border-left:3px solid var(--accent);border-radius:8px;background:var(--bg);padding:8px 10px;margin:6px 2px;font-size:14px;cursor:grab}
.card.doing{border-left-color:var(--warn)}.card.done{border-left-color:var(--ok)}.card.done .c-title{color:var(--muted);text-decoration:line-through}
.c-title{display:block;width:100%;text-align:left;border:0;background:none;padding:0;font-weight:500;line-height:1.4}.c-title:hover{color:var(--accent)}
.c-meta{color:var(--muted);font-size:12px;margin:2px 0 6px}
.c-foot{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.mv{padding:1px 8px;font-size:12px;border-radius:6px}
.due-edit{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--muted);border:1px solid var(--line);border-radius:6px;padding:0 6px;background:var(--panel)}
.due-edit input{border:0;background:none;color:inherit;font:inherit;padding:1px 0;width:112px}
.due-edit.soon{color:var(--warn);background:var(--warn-soft);border-color:transparent}.due-edit.bad{color:var(--bad);background:var(--bad-soft);border-color:transparent}
.none{color:var(--muted);font-size:13px;padding:10px;text-align:center}.none.big{padding:60px 20px;font-size:15px}
.link{border:0;background:none;color:var(--accent);padding:6px 8px;font-size:13px}
.cal-head{display:flex;align-items:center;gap:8px;margin-bottom:10px}.cal-head b{min-width:110px;text-align:center}
.cal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:1px;background:var(--line);border:1px solid var(--line);border-radius:8px;overflow:hidden}
.dow{background:var(--panel);padding:6px;font-size:12px;color:var(--muted);text-align:center}
.day{background:var(--panel);min-height:104px;padding:4px 5px;font-size:12px;overflow:hidden;cursor:pointer}
.day.out{background:var(--bg)}.day.out .dn{opacity:.5}.day.sel{box-shadow:inset 0 0 0 2px var(--accent-soft)}
.day.today .dn{background:var(--accent);color:#fff;border-radius:999px;display:inline-block;min-width:20px;text-align:center}
.dn{font-size:12px;color:var(--muted);margin-bottom:2px}
.dchip{display:block;margin:2px 0;padding:1px 6px;border-radius:5px;font-size:12px;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;background:var(--accent-soft);color:var(--accent)}
.dchip.doing{background:var(--warn-soft);color:var(--warn)}.dchip.done{background:var(--ok-soft);color:var(--ok);text-decoration:line-through}.dchip.bad{background:var(--bad-soft);color:var(--bad)}
.more{font-size:11px;color:var(--muted)}
.sub{margin:22px 0 8px;font-size:14px}.sub.bad{color:var(--bad)}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:4px 10px}
.pool{display:flex;flex-wrap:wrap;gap:4px}.pool .dchip{display:inline-block;max-width:320px;margin:0}
dialog{border:1px solid var(--line);border-radius:12px;background:var(--panel);color:var(--ink);padding:0;width:min(440px,92vw)}
dialog::backdrop{background:rgba(0,0,0,.4)}
.dl{padding:18px 20px}.dl h3{margin:0 0 4px;font-size:17px;line-height:1.35}
.dl-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.dl-row input{padding:5px 8px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);font:inherit}
.dl-foot{display:flex;justify-content:space-between;gap:8px;margin-top:18px}
#boardBtn{margin:0 12px 8px;width:calc(100% - 24px);display:block;text-align:left}
#boardBtn.active{background:var(--accent-soft);color:var(--accent);border-color:var(--accent)}
.chip.due{margin-left:2px}li.task .chip{vertical-align:1px}
@media (max-width:760px){
  .b-top{padding:10px 12px}.b-body{padding:12px 12px 60px}
  .kanban{grid-template-columns:none;grid-auto-flow:column;grid-auto-columns:86%;overflow-x:auto;scroll-snap-type:x mandatory;gap:10px}
  .col{scroll-snap-align:start}.col .list{max-height:60vh}
  .day{min-height:52px;padding:2px}.day .dchip{display:inline-block;width:7px;height:7px;padding:0;margin:1px;border-radius:50%;font-size:0;vertical-align:top}
  .day .more{display:none}.bar2{width:110px}
}
@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto}}`;
document.head.appendChild(css);

window.VMBoard = {show, hide, decorate};
bind();
})();
