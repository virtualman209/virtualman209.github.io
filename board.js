/* Bảng việc: tiến độ, kanban và lịch. Dùng chung cho bản chạy trên máy và bản online.
   Đọc mọi checklist (- [ ] việc) trong các file .md, ghi lại ngay trên chính dòng đó.
   Quy ước trên dòng:
     🛫 YYYY-MM-DD  ngày bắt đầu          📅 YYYY-MM-DD  ngày kết thúc (hạn chót)
     🔴 ưu tiên cao  🟡 ưu tiên vừa  🔵 ưu tiên thấp      #doing  đang làm      [x]  xong
     📊 40%  mức hoàn thành (việc dài hơi, 1–99%; 100% = xong)
   Độ dài = ngày kết thúc − ngày bắt đầu + 1. Chỉ có 📅 thì việc kéo dài 1 ngày.
   Trang chủ phải định nghĩa trước: window.boardAdapter = { list(), update(path, line, expected, newLine, message) } */
(() => {
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
const START_RE = /\s*🛫\s*(\d{4}-\d{2}-\d{2})/, DUE_RE = /\s*📅\s*(\d{4}-\d{2}-\d{2})/, DOING_RE = /\s*#doing\b/i, PRIO_RE = /\s*(🔴|🟡|🔵)/, PCT_RE = /\s*📊\s*(\d{1,3})\s*%/;
const TASK_RE = /^(\s*)([-*+])\s+\[([ xX])\]\s+(.*)$/;
const STATUS = [["todo", "Cần làm"], ["doing", "Đang làm"], ["done", "Xong"]];
const VERB = {todo: "Mở lại", doing: "Đang làm", done: "Xong"};
const PRIO = {high: {emoji: "🔴", name: "Cao", rank: 0}, med: {emoji: "🟡", name: "Vừa", rank: 1}, low: {emoji: "🔵", name: "Thấp", rank: 2}};
const EMOJI_PRIO = {"🔴": "high", "🟡": "med", "🔵": "low"};
const rank = p => p ? PRIO[p].rank : 3;

/* ---------------- ngày tháng (chuỗi YYYY-MM-DD, theo giờ máy) ---------------- */
const pad = n => String(n).padStart(2, "0");
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const addDays = (s, n) => { const [y, m, d] = s.split("-").map(Number); return ymd(new Date(y, m - 1, d + n)); };
const diff = (a, b) => { const u = s => Date.UTC(...s.split("-").map((x, i) => i === 1 ? x - 1 : +x)); return Math.round((u(b) - u(a)) / 864e5); };
const fmt = s => { const [y, m, d] = s.split("-"); return `${d}/${m}` + (+y !== new Date().getFullYear() ? "/" + y : ""); };
const fmtS = s => { const [y, m, d] = s.split("-"); return `${+d}/${+m}/${y.slice(2)}`; };
function dueClass(due, done) {
  if (!due || done) return "";
  const t = today(); return due < t ? "bad" : due <= addDays(t, 7) ? "soon" : "";
}
const days = t => t.rs ? diff(t.rs, t.re) + 1 : 0;
const rangeText = t => !t.rs ? "Chưa có ngày" : t.rs === t.re ? fmt(t.re) : `${fmt(t.rs)} → ${fmt(t.re)} · ${days(t)} ngày`;
function setRange(t) {                                              // khoảng ngày hiệu lực
  t.rs = t.start || t.due; t.re = t.due || t.start;
  if (t.rs && t.re && t.rs > t.re) [t.rs, t.re] = [t.re, t.rs];
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
      const text = m[4], pm = PRIO_RE.exec(text);
      const title = text.replace(START_RE, "").replace(DUE_RE, "").replace(PRIO_RE, "").replace(DOING_RE, "").replace(PCT_RE, "").trim();
      const phase = phaseName(h2 || h1 || d.title);
      const t = {key: d.path + ":" + i, path: d.path, line: i, raw: l, cr, indent: m[1], bullet: m[2],
        done: m[3] !== " ", doing: DOING_RE.test(text), start: (START_RE.exec(text) || [])[1] || "", due: (DUE_RE.exec(text) || [])[1] || "",
        prio: pm ? EMOJI_PRIO[pm[1]] : "", pct: Math.min(100, +((PCT_RE.exec(text) || [])[1] || 0)), title, label: clean(title),
        file: d.title, phase, section: phaseName(h3), pk: d.path + "|" + phase, order: order++};
      setRange(t); out.push(t);
    });
  }
  return out;
}

/* ---------------- trạng thái ---------------- */
const S = {tasks: [], doc: null, adding: null, view: "kanban", file: "", phase: "", prio: "", month: new Date(), sel: today(), moreDone: false, open: null};
S.month = new Date(S.month.getFullYear(), S.month.getMonth(), 1);
const A = () => window.boardAdapter;
const canEdit = () => typeof canWrite === "undefined" || canWrite;
const byKey = k => (S.doc && S.doc.tasks.find(t => t.key === k)) || S.tasks.find(t => t.key === k);
const boardHidden = () => { const b = $("#board"); return !b || b.classList.contains("hidden"); };
function refresh() { if (boardHidden()) { window.rerenderDoc && window.rerenderDoc(); } else load(); }
const cmp = (a, b) => rank(a.prio) - rank(b.prio) || ((a.rs || "9999") < (b.rs || "9999") ? -1 : (a.rs || "9999") > (b.rs || "9999") ? 1 : a.order - b.order);
const visible = () => S.tasks.filter(t => (!S.file || t.path === S.file) && (!S.phase || t.pk === S.phase) && (!S.prio || (S.prio === "none" ? !t.prio : t.prio === S.prio)));

let chain = Promise.resolve();
function buildLine(t, status, start, due, prio, title = t.title, pct = 0) {
  if (start && start === due) start = "";                             // 1 ngày thì không cần ngày bắt đầu
  const pc = status !== "done" && pct > 0 && pct < 100 ? " 📊 " + pct + "%" : "";
  return `${t.indent}${t.bullet} [${status === "done" ? "x" : " "}] ${title}${start ? " 🛫 " + start : ""}${due ? " 📅 " + due : ""}${prio ? " " + PRIO[prio].emoji : ""}${pc}${status === "doing" ? " #doing" : ""}${t.cr ? "\r" : ""}`;
}
function change(t, patch) {                                          // patch: {status?, start?, due?, prio?}
  if (!canEdit()) { toast("Token chỉ có quyền đọc, không sửa được.", true); return Promise.resolve(); }
  let pct = "pct" in patch ? Math.max(0, Math.min(100, Math.round(+patch.pct || 0))) : t.pct;
  let status = patch.status ?? (pct >= 100 ? "done" : "pct" in patch && t.done ? (pct > 0 ? "doing" : "todo") : statusOf(t));
  if ("pct" in patch && pct > 0 && pct < 100 && status === "todo") status = "doing";
  if (status === "done" && !("pct" in patch)) pct = 0;
  const start = "start" in patch ? patch.start : t.start, due = "due" in patch ? patch.due : t.due, prio = "prio" in patch ? patch.prio : t.prio;
  const title = "title" in patch ? patch.title.trim() : t.title;
  if (!title) return Promise.resolve();
  const line = buildLine(t, status, start, due, prio, title, pct);
  if (line === t.raw) return Promise.resolve();
  const bits = [];
  if (status !== statusOf(t)) bits.push(VERB[status]);
  if (start !== t.start || due !== t.due) bits.push("ngày " + (start ? fmt(start) + " → " : "") + (due ? fmt(due) : "bỏ"));
  if (title !== t.title) bits.push("đổi tên");
  if (pct !== t.pct && "pct" in patch) bits.push("hoàn thành " + pct + "%");
  if (prio !== t.prio) bits.push("ưu tiên " + (prio ? PRIO[prio].name.toLowerCase() : "bỏ"));
  const msg = `${bits.join(", ") || "Sửa"}: ${t.label.slice(0, 60)}`;
  const job = chain.then(async () => {
    await A().update(t.path, t.line, t.raw, line, msg);
    t.raw = line; t.done = status === "done"; t.doing = status === "doing"; t.start = start; t.due = due; t.prio = prio; t.pct = status === "done" ? 0 : pct; t.title = title; t.label = clean(title); setRange(t);
    draw(); if (boardHidden()) window.rerenderDoc && window.rerenderDoc();
  });
  chain = job.catch(() => {});
  return job.catch(async e => { toast(e.message, true, 7000); await load(); });
}
function moveTo(t, day) {                                            // kéo việc vào một ngày: giữ nguyên độ dài
  if (t.start) return change(t, {start: day, due: t.due ? addDays(day, diff(t.rs, t.re)) : ""});
  return change(t, {due: day});
}

/* ---------------- vẽ giao diện ---------------- */
const fileCount = () => new Set(S.tasks.map(t => t.path)).size;
const pcls = p => "p-" + (p || "none");
function prioSelect(t, ro) {
  return `<select class="prio-sel ${pcls(t.prio)}" data-act="prio" aria-label="Mức ưu tiên"${ro}><option value=""${t.prio ? "" : " selected"}>Ưu tiên</option>` +
    Object.entries(PRIO).map(([k, v]) => `<option value="${k}"${t.prio === k ? " selected" : ""}>${v.emoji} ${v.name}</option>`).join("") + `</select>`;
}
function cardHtml(t) {
  const st = statusOf(t), cls = dueClass(t.re, t.done), ro = canEdit() ? "" : " disabled";
  return `<div class="card ${st} ${pcls(t.prio)}" draggable="true" data-k="${esc(t.key)}">
    <button class="c-title" data-act="open">${esc(t.label)}</button>
    <div class="c-meta">${esc(t.phase)}${t.section ? " › " + esc(t.section) : ""}${!S.file && fileCount() > 1 ? " · " + esc(t.file) : ""}</div>
    ${t.pct && !t.done ? `<div class="c-pct" title="Đã hoàn thành ${t.pct}%"><i style="width:${t.pct}%"></i><b>${t.pct}%</b></div>` : ""}
    <div class="c-range"><button class="rng ${cls}" data-act="open" title="Sửa ngày bắt đầu, kết thúc, độ dài">📅 ${esc(rangeText(t))}</button></div>
    <div class="c-foot">
      <button class="mv" data-act="mv" data-d="-1" title="Chuyển sang cột trước"${st === "todo" ? " disabled" : ro}>◀</button>
      <button class="mv" data-act="mv" data-d="1" title="Chuyển sang cột sau"${st === "done" ? " disabled" : ro}>▶</button>
      ${prioSelect(t, ro)}
      <button class="mv" data-act="doc" title="Mở trong tài liệu">↗</button>
    </div></div>`;
}

function kanbanHtml(list) {
  return `<div class="kanban">` + STATUS.map(([st, name]) => {
    const all = list.filter(t => statusOf(t) === st).sort(cmp); let items = all, more = 0;
    if (st === "done" && !S.moreDone && items.length > 8) { more = items.length - 8; items = items.slice(0, 8); }
    return `<section class="col" data-col="${st}"><h3>${name} <span>${all.length}</span></h3>
      <div class="list">${items.map(cardHtml).join("") || `<div class="none">Trống</div>`}
      ${more ? `<button class="link" data-act="moredone">Hiện thêm ${more} việc đã xong</button>` : ""}</div></section>`;
  }).join("") + `</div>`;
}

const LANES = 5;
function barHtml(sg) {
  const t = sg.t, st = statusOf(t), late = !t.done && t.re < today();
  const tip = `${t.label}\n${rangeText(t)}${t.prio ? "\nƯu tiên " + PRIO[t.prio].name.toLowerCase() : ""}${late ? "\nQuá hạn" : ""}`;
  return `<div class="bar ${pcls(t.prio)} ${st}${late ? " late" : ""}${sg.capL ? " capl" : ""}${sg.capR ? " capr" : ""}" role="button" tabindex="0" draggable="true" data-k="${esc(t.key)}" data-act="open"
    style="grid-column:${sg.c0 + 1} / span ${sg.c1 - sg.c0 + 1};grid-row:${sg.lane + 1}" title="${esc(tip)}">${esc(t.label)}</div>`;
}
function chipHtml(t) {                                               // chip nhỏ trong danh sách "chưa có ngày"
  const st = statusOf(t);
  return `<div class="dchip ${pcls(t.prio)} ${st}" role="button" tabindex="0" draggable="true" data-k="${esc(t.key)}" data-act="open" title="${esc(t.label)}">${esc(t.label)}</div>`;
}
function weekHtml(ws, list, month) {                                 // một hàng tuần: ô ngày ở dưới, thanh việc nằm đè lên
  const we = addDays(ws, 6), t0 = today();
  const segs = list.filter(t => t.rs && t.re >= ws && t.rs <= we).map(t => {
    const s = t.rs < ws ? ws : t.rs, e = t.re > we ? we : t.re;
    return {t, c0: diff(ws, s), c1: diff(ws, e), capL: t.rs < ws, capR: t.re > we};
  }).sort((a, b) => a.c0 - b.c0 || (b.c1 - b.c0) - (a.c1 - a.c0) || cmp(a.t, b.t));
  const lanes = [];
  segs.forEach(sg => { let l = lanes.findIndex(end => end < sg.c0); if (l < 0) { l = lanes.length; lanes.push(-1); } lanes[l] = sg.c1; sg.lane = l; });
  const shown = segs.filter(sg => sg.lane < LANES), hidden = Array(7).fill(0);
  segs.filter(sg => sg.lane >= LANES).forEach(sg => { for (let c = sg.c0; c <= sg.c1; c++) hidden[c]++; });
  const nl = Math.min(lanes.length, LANES) + (hidden.some(Boolean) ? 1 : 0);
  const cells = Array.from({length: 7}, (_, c) => {
    const k = addDays(ws, c), d = +k.slice(8), out = +k.slice(5, 7) - 1 !== month;
    return `<div class="day${out ? " out" : ""}${k === t0 ? " today" : ""}${k === S.sel ? " sel" : ""}" data-day="${k}"><div class="dn">${d}</div>${hidden[c] ? `<div class="more">+${hidden[c]} việc</div>` : ""}</div>`;
  }).join("");
  return `<div class="wk" data-ws="${ws}" style="--nl:${nl}"><div class="wk-days">${cells}</div><div class="wk-bars">${shown.map(barHtml).join("")}</div></div>`;
}
function calHtml(list) {
  const y = S.month.getFullYear(), m = S.month.getMonth(), t0 = today();
  const first = new Date(y, m, 1), start = ymd(new Date(y, m, 1 - ((first.getDay() + 6) % 7)));          // tuần bắt đầu từ thứ Hai
  const rows = diff(start, ymd(new Date(y, m + 1, 0))) >= 35 ? 6 : 5;
  const weeks = Array.from({length: rows}, (_, i) => weekHtml(addDays(start, i * 7), list, m)).join("");
  const onDay = list.filter(t => t.rs && t.rs <= S.sel && t.re >= S.sel).sort(cmp);
  const late = list.filter(t => !t.done && t.re && t.re < t0).sort(cmp);
  const free = list.filter(t => !t.done && !t.rs).sort(cmp);
  return `<div class="cal-head"><button data-act="mprev" aria-label="Tháng trước">◀</button>
      <b>Tháng ${m + 1}/${y}</b><button data-act="mnext" aria-label="Tháng sau">▶</button><button data-act="mtoday">Hôm nay</button>
      <span class="legend"><i class="dot p-high"></i>Cao <i class="dot p-med"></i>Vừa <i class="dot p-low"></i>Thấp <i class="dot p-none"></i>Chưa gán</span></div>
    <div class="cal-grid"><div class="dows">${["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map(x => `<div class="dow">${x}</div>`).join("")}</div>${weeks}</div>
    <h4 class="sub">Việc đang diễn ra ngày ${fmt(S.sel)} (${onDay.length})</h4>
    <div class="cards">${onDay.map(cardHtml).join("") || `<div class="none">Không có việc nào. Kéo một việc vào ngày này để đặt lịch.</div>`}</div>
    ${late.length ? `<h4 class="sub bad">Quá hạn (${late.length})</h4><div class="pool">${late.map(chipHtml).join("")}</div>` : ""}
    <h4 class="sub">Chưa có ngày (${free.length}): kéo vào một ngày trên lịch để đặt lịch</h4>
    <div class="pool">${free.slice(0, 60).map(chipHtml).join("") || `<div class="none">Mọi việc đều đã có ngày.</div>`}${free.length > 60 ? `<div class="more">… và ${free.length - 60} việc nữa</div>` : ""}</div>`;
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
  const late = all.filter(t => !t.done && t.re && t.re < t0).length;
  const soon = all.filter(t => !t.done && t.re && t.re >= t0 && t.re <= addDays(t0, 7)).length;
  const doing = all.filter(t => !t.done && t.doing).length;
  const files = [...new Map(S.tasks.map(t => [t.path, t.file])).entries()];
  const scrollTop = root.scrollTop;
  root.innerHTML = `<div class="b-top">
    <div class="b-row">
      <div class="seg"><button data-act="view" data-v="kanban" class="${S.view === "kanban" ? "on" : ""}">Kanban</button><button data-act="view" data-v="cal" class="${S.view === "cal" ? "on" : ""}">Lịch</button></div>
      <select id="bFile" aria-label="Lọc theo tài liệu"><option value="">Tất cả tài liệu</option>${files.map(([p, t]) => `<option value="${esc(p)}"${p === S.file ? " selected" : ""}>${esc(t)}</option>`).join("")}</select>
      <select id="bPrio" aria-label="Lọc theo mức ưu tiên"><option value="">Mọi mức ưu tiên</option><option value="high"${S.prio === "high" ? " selected" : ""}>🔴 Ưu tiên cao</option><option value="med"${S.prio === "med" ? " selected" : ""}>🟡 Ưu tiên vừa</option><option value="low"${S.prio === "low" ? " selected" : ""}>🔵 Ưu tiên thấp</option><option value="none"${S.prio === "none" ? " selected" : ""}>Chưa gán ưu tiên</option></select>
      <button data-act="reload" title="Tải lại từ nguồn">↻ Tải lại</button>
      ${S.phase ? `<button data-act="clearphase">Bỏ lọc giai đoạn ✕</button>` : ""}
    </div>
    <div class="b-row sum"><div class="bar2"><i style="width:${pct}%"></i></div><b>${pct}%</b><span>${done}/${all.length} việc đã xong</span>
      ${late ? `<span class="chip due bad">Quá hạn ${late}</span>` : ""}${soon ? `<span class="chip due soon">Hạn trong 7 ngày ${soon}</span>` : ""}${doing ? `<span class="chip doing">Đang làm ${doing}</span>` : ""}</div>
    <div class="phases">${phasesOf().map(p => `<button class="ph${p.pk === S.phase ? " on" : ""}" data-act="phase" data-pk="${esc(p.pk)}" title="Bấm để chỉ xem giai đoạn này">
      <span class="pn">${esc(p.name)}</span><span class="pc">${p.done}/${p.total}</span><span class="track"><i style="width:${p.total ? 100 * p.done / p.total : 0}%"></i></span></button>`).join("")}</div>
  </div><div class="b-body">${S.tasks.length ? (S.view === "kanban" ? kanbanHtml(list) : calHtml(list))
    : `<div class="none big">Chưa có checklist nào. Thêm dòng dạng <code>- [ ] việc cần làm 🛫 2026-12-01 📅 2026-12-31 🔴</code> vào một file .md.</div>`}</div>`;
  root.scrollTop = scrollTop;
  if (S.open) renderDialog();
}

/* ---------------- hộp chỉnh sửa một việc ---------------- */
function dlg() {
  let d = $("#bDlg");
  if (!d) { d = document.createElement("dialog"); d.id = "bDlg"; document.body.appendChild(d); d.addEventListener("close", () => { S.open = null; S.adding = null; }); }
  return d;
}
function renderDialog() {
  const d = dlg(); if (S.adding) return renderAdd(d);
  const t = byKey(S.open); if (!t) { if (d.open) d.close(); return; }
  const st = statusOf(t), ro = canEdit() ? "" : " disabled", n = days(t);
  d.innerHTML = `<div class="dl"><input class="dl-title" data-act="dtitle" value="${esc(t.title)}" maxlength="300" aria-label="Nội dung việc"${ro}><div class="c-meta">${esc(t.file)} › ${esc(t.phase)}${t.section ? " › " + esc(t.section) : ""}</div>
    <div class="lbl">Trạng thái</div>
    <div class="seg full">${STATUS.map(([k, nm]) => `<button data-act="dst" data-st="${k}" class="${st === k ? "on" : ""}"${ro}>${nm}</button>`).join("")}</div>
    <div class="lbl">Mức hoàn thành <b class="pct-v">${t.done ? 100 : t.pct}%</b></div>
    <div class="dl-pct"><input type="range" min="0" max="100" step="5" data-act="dpct" value="${t.done ? 100 : t.pct}"${ro}><input type="number" min="0" max="100" data-act="dpct" value="${t.done ? 100 : t.pct}"${ro}><span>%</span></div>
    <div class="lbl">Mức ưu tiên</div>
    <div class="seg full prio">${[["", "Chưa gán"], ["high", "🔴 Cao"], ["med", "🟡 Vừa"], ["low", "🔵 Thấp"]].map(([k, nm]) => `<button data-act="dprio" data-p="${k}" class="${pcls(k)}${t.prio === k ? " on" : ""}"${ro}>${nm}</button>`).join("")}</div>
    <div class="lbl">Thời gian</div>
    <div class="dl-grid">
      <label>Bắt đầu<input type="date" data-act="dstart" value="${t.start}"${ro}></label>
      <label>Kết thúc (hạn chót)<input type="date" data-act="dend" value="${t.due}"${ro}></label>
      <label>Kéo dài (ngày)<input type="number" min="1" max="999" data-act="ddays" value="${n || ""}" placeholder="—"${ro}></label>
    </div>
    <div class="dl-note">${t.rs ? esc(rangeText(t)) : "Chưa có ngày nào."} <button class="link" data-act="dclear"${ro}>Xoá ngày</button></div>
    <div class="dl-foot"><button class="danger" data-act="ddel"${ro}>Xoá việc</button>${boardHidden() ? "" : `<button data-act="ddoc">Mở trong tài liệu ↗</button>`}<button class="primary" data-act="dclose">Đóng</button></div></div>`;
  if (!d.open) d.showModal();
}
function renderAdd(d) {
  const a = S.adding;
  d.innerHTML = `<div class="dl"><h3>Thêm task mới</h3><div class="c-meta">${esc(a.where)}</div>
    <div class="lbl">Nội dung</div><input class="dl-title" data-act="atitle" placeholder="Việc cần làm…" value="${esc(a.title)}" maxlength="300">
    <div class="lbl">Mức ưu tiên</div>
    <div class="seg full prio">${[["", "Chưa gán"], ["high", "🔴 Cao"], ["med", "🟡 Vừa"], ["low", "🔵 Thấp"]].map(([k, nm]) => `<button data-act="aprio" data-p="${k}" class="${pcls(k)}${a.prio === k ? " on" : ""}">${nm}</button>`).join("")}</div>
    <div class="lbl">Thời gian (không bắt buộc)</div>
    <div class="dl-grid two"><label>Bắt đầu<input type="date" data-act="adstart" value="${a.start}"></label><label>Kết thúc (hạn chót)<input type="date" data-act="adend" value="${a.due}"></label></div>
    <div class="dl-foot"><button data-act="acancel">Huỷ</button><button class="primary" data-act="aok">Thêm</button></div></div>`;
  if (!d.open) d.showModal();
  const i = d.querySelector('[data-act="atitle"]'); if (i && !i.value) i.focus();
}
function openAdd(after, like) {
  const l = byKey(like || after); if (!l || !byKey(after)) return;
  if (!canEdit()) { toast("Token chỉ có quyền đọc, không sửa được.", true); return; }
  S.open = null; S.adding = {after, like: l.key, title: "", prio: "", start: "", due: "", where: l.phase + (l.section ? " › " + l.section : "")};
  renderAdd(dlg());
}
async function addSubmit() {
  const a = S.adding, title = a.title.trim(), after = byKey(a.after), like = byKey(a.like) || after;
  if (!title) { toast("Hãy nhập nội dung việc.", true); return; }
  let {start, due} = a; if (start && due && start > due) [start, due] = [due, start];
  const nl = buildLine(like, "todo", start, due, a.prio, title);
  const job = chain.then(() => A().update(after.path, after.line, after.raw, after.raw + "\n" + nl, "Thêm việc: " + title.slice(0, 60)));
  chain = job.catch(() => {});
  try { await job; S.adding = null; dlg().close(); refresh(); } catch (e) { toast(e.message, true, 7000); }
}
async function removeTask(t) {
  if (!confirm("Xoá việc này khỏi file?\n\n" + t.label)) return;
  const job = chain.then(() => A().update(t.path, t.line, t.raw, null, "Xoá việc: " + t.label.slice(0, 60)));
  chain = job.catch(() => {});
  try { await job; S.open = null; dlg().close(); refresh(); } catch (e) { toast(e.message, true, 7000); }
}
function dialogDates(t, el) {                                         // đổi ngày bắt đầu / kết thúc / số ngày
  const v = el.value, k = el.dataset.act;
  if (k === "dstart") return change(t, {start: v, due: v && t.due && t.due < v ? v : t.due});
  if (k === "dend") return change(t, {due: v, start: v && t.start && t.start > v ? v : t.start});
  const n = Math.max(1, Math.min(999, parseInt(v, 10) || 0));         // số ngày
  if (!v || !n) return;
  const s = t.start || (t.due ? addDays(t.due, -(n - 1)) : ""), e = s ? addDays(s, n - 1) : "";
  if (!s) { toast("Hãy chọn ngày bắt đầu hoặc kết thúc trước.", true); renderDialog(); return; }
  return change(t, n === 1 ? {start: "", due: e} : {start: s, due: e});
}

/* ---------------- sự kiện ---------------- */
function dayAt(wk, x) {                                               // ngày ứng với vị trí chuột trong một hàng tuần
  const r = wk.getBoundingClientRect(); return addDays(wk.dataset.ws, Math.max(0, Math.min(6, Math.floor((x - r.left) / (r.width / 7)))));
}
function bind() {
  const root = $("#board");
  root.addEventListener("click", e => {
    const el = e.target.closest("[data-act]"); if (!el) { const day = e.target.closest(".day"); if (day) { S.sel = day.dataset.day; draw(); } return; }
    const act = el.dataset.act, card = el.closest("[data-k]"), t = card && byKey(card.dataset.k);
    if (act === "prio") return;                                       // xử lý ở sự kiện change
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
    if (e.target.id === "bPrio") { S.prio = e.target.value; draw(); return; }
    const el = e.target.closest('[data-act="prio"]'); if (!el) return;
    const t = byKey(el.closest("[data-k]").dataset.k); if (t) change(t, {prio: el.value});
  });
  root.addEventListener("keydown", e => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches(".dchip,.bar")) { e.preventDefault(); S.open = e.target.dataset.k; renderDialog(); }
  });
  /* kéo thả (máy tính): thả vào cột để đổi trạng thái, thả vào ngày để đặt lịch (giữ nguyên độ dài) */
  let drag = null;
  const mark = z => root.querySelectorAll(".over").forEach(x => x !== z && x.classList.remove("over"));
  root.addEventListener("dragstart", e => {
    const el = e.target.closest("[data-k]"); if (!el) return;
    drag = el.dataset.k; e.dataTransfer.setData("text/plain", drag); e.dataTransfer.effectAllowed = "move";
  });
  root.addEventListener("dragend", () => { drag = null; mark(null); });
  root.addEventListener("dragover", e => {
    if (!drag) return;
    const col = e.target.closest(".col"), wk = e.target.closest(".wk");
    if (col) { e.preventDefault(); mark(col); col.classList.add("over"); }
    else if (wk) {
      e.preventDefault(); const k = dayAt(wk, e.clientX), cell = wk.querySelector(`.day[data-day="${k}"]`);
      mark(cell); cell && cell.classList.add("over");
    }
  });
  root.addEventListener("drop", e => {
    if (!drag) return;
    const col = e.target.closest(".col"), wk = e.target.closest(".wk"); if (!col && !wk) return;
    e.preventDefault(); mark(null);
    const t = byKey(drag); drag = null; if (!t) return;
    if (col) change(t, {status: col.dataset.col}); else { const k = dayAt(wk, e.clientX); S.sel = k; moveTo(t, k); }
  });
  dlg().addEventListener("input", e => {
    if (e.target.dataset.act !== "dpct") return;
    const v = Math.max(0, Math.min(100, +e.target.value || 0));
    dlg().querySelectorAll('[data-act="dpct"]').forEach(x => { if (x !== e.target) x.value = v; });
    const b = dlg().querySelector(".pct-v"); if (b) b.textContent = v + "%";
  });
  dlg().addEventListener("input", e => { if (S.adding && e.target.dataset.act === "atitle") S.adding.title = e.target.value; });
  dlg().addEventListener("keydown", e => { if (e.key === "Enter" && S.adding && e.target.dataset.act === "atitle") { e.preventDefault(); S.adding.title = e.target.value; addSubmit(); } });
  dlg().addEventListener("click", e => {
    if (S.adding) {
      const b = e.target.closest("[data-act]"), a = b && b.dataset.act;
      if (a === "acancel") dlg().close(); else if (a === "aok") addSubmit();
      else if (a === "aprio") { S.adding.prio = b.dataset.p; renderAdd(dlg()); }
      else if (e.target === dlg()) dlg().close();
      return;
    }
    const el = e.target.closest("[data-act]"), t = byKey(S.open); if (!el || !t) { if (e.target === dlg()) dlg().close(); return; }
    const act = el.dataset.act;
    if (act === "dclose") dlg().close();
    else if (act === "dst") change(t, {status: el.dataset.st});
    else if (act === "dprio") change(t, {prio: el.dataset.p});
    else if (act === "dclear") change(t, {start: "", due: ""});
    else if (act === "ddoc") { dlg().close(); openDoc(t); }
    else if (act === "ddel") removeTask(t);
  });
  dlg().addEventListener("change", e => {
    const k = e.target.dataset.act || "";
    if (S.adding) { if (k === "adstart") S.adding.start = e.target.value; else if (k === "adend") S.adding.due = e.target.value; else if (k === "atitle") S.adding.title = e.target.value; return; }
    const t = byKey(S.open); if (!t) return;
    if (k === "dpct") { change(t, {pct: e.target.value}); return; }
    if (k === "dtitle") { if (e.target.value.trim()) change(t, {title: e.target.value}); else e.target.value = t.title; }
    else if (/^d(start|end|days)$/.test(k)) dialogDates(t, e.target);
  });
}
function openDoc(t) { hide(); window.go(t.path, t.label); }

/* ---------------- tải dữ liệu, hiện / ẩn ---------------- */
async function load() {
  const root = $("#board");
  if (!S.tasks.length) root.innerHTML = `<div class="none big">Đang tải việc…</div>`;
  try { S.tasks = parseDocs(await A().list()); }
  catch (e) { toast(e.message, true, 6000); root.innerHTML = `<div class="none big">${esc(e.message)}</div>`; return; }
  if (!S.init) { S.init = true; const plan = S.tasks.find(t => /(^|\/)tasks\.md$/.test(t.path)) || S.tasks.find(t => /(^|\/)plan\.md$/.test(t.path)); if (plan) S.file = plan.path; }   // lần đầu: xem kế hoạch chính
  if (S.file && !S.tasks.some(t => t.path === S.file)) S.file = "";
  if (S.phase && !S.tasks.some(t => t.pk === S.phase)) S.phase = "";
  draw();
}
async function show() {
  S.doc = null;
  if (editing && dirty && !confirm("Bạn có thay đổi chưa lưu. Bỏ qua?")) return;
  setEditing(false); cur = null; drawNav();
  $("#viewScroll").classList.add("hidden"); $("#editBtn").classList.add("hidden"); $("#progress").classList.add("hidden");
  $("#board").classList.remove("hidden"); $("#crumb").textContent = "Bảng việc";
  $("#boardBtn").classList.add("active");
  if (location.hash.slice(1) !== "board") history.replaceState(null, "", "#board");
  await load();
}
function hide() { $("#board").classList.add("hidden"); $("#boardBtn").classList.remove("active"); if (dlg().open) dlg().close(); }

/* ---------------- đổi thứ tự việc bằng kéo thả (trong tài liệu) ---------------- */
const wsOf = l => /^[ \t]*/.exec(l)[0];
function blockEnd(ls, i) {                                            // một việc gồm dòng của nó và các dòng thụt sâu hơn ngay sau (việc con, đoạn nối)
  const a = wsOf(ls[i]).length; let e = i + 1;
  while (e < ls.length && ls[e].trim() && wsOf(ls[e]).length > a) e++;
  return e;
}
function moveBlock(ls, from, to, after) {                             // chuyển khối `from` tới trước / sau khối `to`; trả về mảng mới
  const fe = blockEnd(ls, from); if (to >= from && to < fe) return ls;
  let ins = after ? blockEnd(ls, to) : to;
  const aInd = wsOf(ls[from]), bInd = wsOf(ls[to]);
  const blk = ls.slice(from, fe).map(l => l.startsWith(aInd) ? bInd + l.slice(aInd.length) : l);
  const rest = ls.slice(0, from).concat(ls.slice(fe));
  if (ins > from) ins -= fe - from;
  return rest.slice(0, ins).concat(blk, rest.slice(ins));
}
async function moveTask(fromKey, toKey, after) {
  const a = byKey(fromKey), b = byKey(toKey); if (!a || !b || a.path !== b.path || a.key === b.key) return;
  if (!canEdit()) { toast("Token chỉ có quyền đọc, không sửa được.", true); return; }
  const job = chain.then(() => A().edit(a.path, [{i: a.line, text: a.raw}, {i: b.line, text: b.raw}], ls => moveBlock(ls, a.line, b.line, after), "Đổi thứ tự: " + a.label.slice(0, 60)));
  chain = job.catch(() => {});
  try { await job; refresh(); } catch (e) { toast(e.message, true, 7000); refresh(); }
}

/* ---------------- thu gọn checklist theo mục (bấm tiêu đề để mở) ---------------- */
function foldSections(el, path) {
  const total = el.querySelectorAll("li.task:not(.task-add)").length; if (!total) return;
  const key = "vm.fold:" + path; let st = {}; try { st = JSON.parse(localStorage.getItem(key) || "{}") || {}; } catch {}
  const save = () => { try { localStorage.setItem(key, JSON.stringify(st)); } catch {} };
  const isOpen = id => id in st ? st[id] : total <= 15;                  // tài liệu ít việc thì mở sẵn, nhiều việc thì thu gọn
  const folds = [];
  for (const L of [3, 2]) {
    const kids = [...el.children];
    kids.forEach((h, i) => {
      if (h.tagName !== "H" + L) return;
      const nodes = []; for (let j = i + 1; j < kids.length; j++) { if (/^H[1-6]$/.test(kids[j].tagName) && +kids[j].tagName[1] <= L) break; nodes.push(kids[j]); }
      const has = nodes.some(n => n.querySelector && n.querySelector("li.task:not(.task-add)")); if (!has) return;
      const body = document.createElement("div"); body.className = "fold-body"; h.after(body); nodes.forEach(n => body.appendChild(n));
      const tasks = body.querySelectorAll("li.task:not(.task-add)"), done = body.querySelectorAll("li.task.done:not(.task-add)").length;
      const id = L + ":" + h.textContent.trim();
      h.classList.add("fold-h"); h.tabIndex = 0; h.setAttribute("role", "button");
      h.insertAdjacentHTML("afterbegin", `<span class="chev">▾</span>`);
      h.insertAdjacentHTML("beforeend", `<span class="fold-c">${done}/${tasks.length}</span>`);
      const set = on => { h.classList.toggle("open", on); body.hidden = !on; h.setAttribute("aria-expanded", on); };
      set(isOpen(id));
      const toggle = () => { const on = !h.classList.contains("open"); set(on); st[id] = on; save(); };
      h.onclick = toggle; h.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } };
      folds.push({h, set, id});
    });
  }
  if (folds.length > 1) {
    const bar = document.createElement("div"); bar.className = "fold-bar";
    bar.innerHTML = `<button data-o="1">Mở tất cả</button><button data-o="0">Thu gọn tất cả</button>`;
    bar.onclick = e => { const b = e.target.closest("button"); if (!b) return; const on = b.dataset.o === "1"; folds.forEach(f => { f.set(on); st[f.id] = on; }); save(); };
    folds.map(f => f.h).sort((a, b) => a.compareDocumentPosition(b) & 4 ? -1 : 1)[0].before(bar);
  }
}

/* ---------------- trong tài liệu: hạn mờ, chấm ưu tiên, bấm vào việc để sửa, dòng "Thêm task mới" ---------------- */
function decorate(el, ctx) {
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), nodes = [], t0 = today(), soon = addDays(t0, 14);
  while (w.nextNode()) nodes.push(w.currentNode);
  for (const n of nodes) {
    if (!/[🛫📅🔴🟡🔵📊]|#doing\b/i.test(n.nodeValue) || n.parentElement.closest("pre,code")) continue;
    const done = !!n.parentElement.closest("li.task.done"), frag = document.createDocumentFragment();
    const re = /\s*(?:🛫\s*\d{4}-\d{2}-\d{2}|📅\s*(\d{4}-\d{2}-\d{2})|(🔴|🟡|🔵)|📊\s*(\d{1,3})\s*%|#doing\b)/gi;
    let last = 0, m; const v = n.nodeValue;
    while ((m = re.exec(v))) {
      frag.append(v.slice(last, m.index)); last = re.lastIndex;
      if (m[0].includes("🛫")) continue;                              // ngày bắt đầu: không hiện
      const s = document.createElement("span"); frag.append(" ");
      if (m[1]) { s.className = "chip dl" + (!done && m[1] <= soon ? " bad" : ""); s.textContent = fmtS(m[1]); s.title = "Hạn chót " + fmt(m[1]); }
      else if (m[3]) { s.className = "chip pctc"; s.textContent = m[3] + "%"; s.title = "Đã hoàn thành " + m[3] + "%"; }
      else if (m[2]) { const p = EMOJI_PRIO[m[2]]; s.className = "pdot " + pcls(p); s.title = "Ưu tiên " + PRIO[p].name.toLowerCase(); }
      else { s.className = "chip doing"; s.textContent = "Đang làm"; }
      frag.append(s);
    }
    frag.append(v.slice(last)); n.replaceWith(frag);
  }
  el.onclick = el.ondragstart = el.ondragover = el.ondrop = el.ondragend = null;
  if (!ctx || !ctx.interactive) return;
  const tasks = parseDocs([{path: ctx.path, title: ctx.path, text: ctx.text}]);
  S.doc = {path: ctx.path, tasks};
  const items = [...el.querySelectorAll("li.task")];
  items.forEach((li, i) => { const t = tasks.find(x => x.line === ctx.lines[i]); if (t) { li.dataset.k = t.key; if (canEdit()) li.draggable = true; } });
  if (canEdit()) new Set(items.map(li => li.parentElement)).forEach(ul => {
    const mine = [...ul.querySelectorAll("li.task")].filter(li => li.dataset.k), first = mine.find(li => li.parentElement === ul);
    if (!first) return;
    const add = document.createElement("li"); add.className = "task task-add"; add.dataset.after = mine[mine.length - 1].dataset.k; add.dataset.like = first.dataset.k;
    add.innerHTML = `<span class="fbox"></span>Thêm task mới`; ul.appendChild(add);
  });
  el.onclick = e => {
    if (e.target.closest("a,input,button") || String(window.getSelection()).length) return;
    const add = e.target.closest("li.task-add"); if (add) return openAdd(add.dataset.after, add.dataset.like);
    const li = e.target.closest("li.task"); if (li && li.dataset.k) { S.adding = null; S.open = li.dataset.k; renderDialog(); }
  };
  let drag = null;                                                     // kéo thả để đổi thứ tự
  const clear = () => el.querySelectorAll(".drop-before,.drop-after").forEach(x => x.classList.remove("drop-before", "drop-after"));
  const place = (li, y) => { const r = li.getBoundingClientRect(); return y > r.top + Math.min(r.height / 2, 16); };
  el.ondragstart = e => { const li = e.target.closest && e.target.closest("li.task[data-k]"); if (!li) return; drag = li.dataset.k; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", drag); li.classList.add("dragging"); };
  el.ondragover = e => {
    if (!drag) return; const li = e.target.closest("li.task[data-k]"); if (!li || li.dataset.k === drag) return;
    e.preventDefault(); clear(); li.classList.add(place(li, e.clientY) ? "drop-after" : "drop-before");
  };
  el.ondrop = e => {
    if (!drag) return; const li = e.target.closest("li.task[data-k]"); if (!li) return;
    e.preventDefault(); const k = drag, after = place(li, e.clientY); drag = null; clear(); moveTask(k, li.dataset.k, after);
  };
  el.ondragend = () => { drag = null; clear(); el.querySelectorAll(".dragging").forEach(x => x.classList.remove("dragging")); };
  foldSections(el, ctx.path);
  if (S.open && !S.adding && dlg().open) renderDialog();
}

/* ---------------- giao diện ---------------- */
const css = document.createElement("style");
css.textContent = `
:root{--bad:#c2372d;--bad-soft:#fbe4e1;
  --ph:#e53935;--ph-bg:#fde3e1;--ph-fg:#8f1d14;--pm:#f5b400;--pm-bg:#fff0b8;--pm-fg:#6b4e00;--pl:#1e88e5;--pl-bg:#dbeafe;--pl-fg:#1b4a8f;--pn:#9aa0a6;--pn-bg:#eceef1;--pn-fg:#555b63}
@media (prefers-color-scheme:dark){:root{--bad:#ff8a80;--bad-soft:#3d1f1c;
  --ph:#ff6b64;--ph-bg:#4a2220;--ph-fg:#ffb4ab;--pm:#f2c230;--pm-bg:#4a3b10;--pm-fg:#ffd866;--pl:#6aa6f0;--pl-bg:#1d3556;--pl-fg:#a9c8f5;--pn:#7b8087;--pn-bg:#2a2d33;--pn-fg:#aab0b8}}
.p-high{--on:#fff;--c:var(--ph);--bg2:var(--ph-bg);--fg2:var(--ph-fg)}.p-med{--on:#3b2a00;--c:var(--pm);--bg2:var(--pm-bg);--fg2:var(--pm-fg)}
.p-low{--on:#fff;--c:var(--pl);--bg2:var(--pl-bg);--fg2:var(--pl-fg)}.p-none{--on:#fff;--c:var(--pn);--bg2:var(--pn-bg);--fg2:var(--pn-fg)}
.board{flex:1;min-height:0;overflow:auto}
.b-top{padding:14px 24px 12px;border-bottom:1px solid var(--line);background:var(--panel);display:flex;flex-direction:column;gap:12px}
.b-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.b-top select{padding:6px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);font:inherit;max-width:100%}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden}
.seg button{border:0;border-radius:0;background:none}.seg button.on{background:var(--accent-soft);color:var(--accent);font-weight:500}
.seg.full{display:flex;margin:4px 0 12px}.seg.full button{flex:1}
.seg.prio button.on{background:var(--bg2);color:var(--fg2);box-shadow:inset 0 -3px 0 var(--c)}
.sum{font-size:13px;color:var(--muted)}.sum b{color:var(--ink)}
.bar2{width:160px;height:8px;border-radius:9px;background:var(--line);overflow:hidden}.bar2 i{display:block;height:100%;background:var(--ok)}
.chip{display:inline-block;padding:0 8px;border-radius:999px;font-size:12px;line-height:20px;white-space:nowrap}
.chip.due{background:var(--bg);border:1px solid var(--line);color:var(--muted)}
.chip.due.soon{background:var(--warn-soft);border-color:transparent;color:var(--warn)}
.chip.due.bad{background:var(--bad-soft);border-color:transparent;color:var(--bad)}
.chip.doing{background:var(--accent-soft);color:var(--accent)}
.chip.prio{background:var(--bg2);color:var(--fg2);box-shadow:inset 3px 0 0 var(--c)}
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
.col.over{outline:2px dashed var(--accent);outline-offset:-3px}
.card{border:1px solid var(--line);border-left:4px solid var(--c);border-radius:8px;background:var(--bg);padding:8px 10px;margin:6px 2px;font-size:14px;cursor:grab}
.card.done{opacity:.7}.card.done .c-title{color:var(--muted);text-decoration:line-through}
.c-title{display:block;width:100%;text-align:left;border:0;background:none;padding:0;font-weight:500;line-height:1.4}.c-title:hover{color:var(--accent)}
.c-meta{color:var(--muted);font-size:12px;margin:2px 0 6px}
.c-range{margin-bottom:6px}
.c-pct{position:relative;height:16px;border-radius:9px;background:var(--line);overflow:hidden;margin-bottom:6px}.c-pct i{display:block;height:100%;background:var(--accent)}.c-pct b{position:absolute;right:7px;top:0;font-size:11px;line-height:16px;font-weight:600}
.dl-pct{display:flex;align-items:center;gap:10px;margin:4px 0 12px}.dl-pct input[type=range]{flex:1;accent-color:var(--accent)}.dl-pct input[type=number]{width:70px;padding:5px 8px;font:inherit;font-size:16px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink)}
.chip.pctc{background:var(--accent-soft);color:var(--accent);font-weight:600}
.rng{padding:1px 8px;font-size:12px;border-radius:999px;color:var(--muted);background:var(--panel)}
.rng.soon{color:var(--warn);background:var(--warn-soft);border-color:transparent}.rng.bad{color:var(--bad);background:var(--bad-soft);border-color:transparent}
.c-foot{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.mv{padding:1px 8px;font-size:12px;border-radius:6px}
.prio-sel{font:inherit;font-size:12px;padding:1px 4px;border:1px solid var(--line);border-radius:6px;background:var(--bg2);color:var(--fg2);max-width:96px}
.none{color:var(--muted);font-size:13px;padding:10px;text-align:center}.none.big{padding:60px 20px;font-size:15px}
.link{border:0;background:none;color:var(--accent);padding:6px 8px;font-size:13px}
.cal-head{display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap}.cal-head b{min-width:110px;text-align:center}
.legend{margin-left:auto;font-size:12px;color:var(--muted);display:flex;align-items:center;gap:4px}
.dot{display:inline-block;width:10px;height:10px;border-radius:3px;background:var(--c);margin-left:8px}
.cal-grid{border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--line)}
.dows{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:1px}
.dow{background:var(--panel);padding:6px;font-size:12px;color:var(--muted);text-align:center}
.wk{--lh:24px;position:relative;margin-top:1px}
.wk-days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:1px;min-height:calc(36px + var(--nl) * (var(--lh) + 2px))}
.day{background:var(--panel);padding:4px 6px;font-size:12px;cursor:pointer;position:relative}
.day.out{background:var(--bg)}.day.out .dn{color:var(--muted);opacity:.6}.day.sel{box-shadow:inset 0 0 0 2px var(--accent)}.day.over{outline:2px dashed var(--accent);outline-offset:-3px}
.day.today{background:#fdf6e0}@media (prefers-color-scheme:dark){.day.today{background:#3a3320}}.day.today .dn{font-weight:700}
.dn{font-size:12px;color:var(--ink);height:20px;text-align:right}
.day .more{position:absolute;left:5px;bottom:2px;font-size:11px;color:var(--muted)}
.wk-bars{position:absolute;left:0;right:0;top:28px;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));grid-auto-rows:var(--lh);row-gap:2px;pointer-events:none}
.bar{pointer-events:auto;margin:0 3px;padding:0 8px;border-radius:5px;background:var(--c);color:var(--on);font-size:12px;line-height:var(--lh);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;box-shadow:0 1px 1px rgba(0,0,0,.15)}
.bar.capl{margin-left:0;border-top-left-radius:0;border-bottom-left-radius:0}.bar.capr{margin-right:0;border-top-right-radius:0;border-bottom-right-radius:0}
.bar.doing{font-weight:600}.bar.doing::before{content:"▶ "}
.bar.late::before{content:"⚠ "}
.bar.done{opacity:.5;text-decoration:line-through}
.bar:hover{filter:brightness(1.08)}
.dchip{display:block;margin:2px 0;padding:1px 8px;border-radius:5px;font-size:12px;line-height:1.5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;background:var(--c);color:var(--on)}
.dchip.done{opacity:.5;text-decoration:line-through}
.more{font-size:11px;color:var(--muted)}
.sub{margin:22px 0 8px;font-size:14px}.sub.bad{color:var(--bad)}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:4px 10px}
.pool{display:flex;flex-wrap:wrap;gap:4px}.pool .dchip{display:inline-block;max-width:320px;margin:0}
dialog{border:1px solid var(--line);border-radius:12px;background:var(--panel);color:var(--ink);padding:0;width:min(460px,92vw)}
dialog::backdrop{background:rgba(0,0,0,.4)}
.dl{padding:18px 20px}.dl h3{margin:0 0 4px;font-size:17px;line-height:1.35}.lbl{font-size:12px;color:var(--muted);margin:12px 0 2px}
.dl-grid{display:grid;grid-template-columns:1fr 1fr 90px;gap:8px;margin-top:4px}.dl-grid label{display:flex;flex-direction:column;gap:2px;font-size:12px;color:var(--muted)}
.dl-grid input{padding:5px 6px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);font:inherit;font-size:14px;min-width:0}
.dl-note{font-size:13px;color:var(--muted);margin-top:8px}
.dl-foot{display:flex;justify-content:space-between;gap:8px;margin-top:18px}
#boardBtn{margin:0 12px 8px;width:calc(100% - 24px);display:block;text-align:left}
#boardBtn.active{background:var(--accent-soft);color:var(--accent);border-color:var(--accent)}
.chip.due{margin-left:2px}li.task .chip{vertical-align:1px}
.chip.dl{background:none;border:0;padding:0 2px;color:var(--muted);opacity:.75;font-size:.85em;font-variant-numeric:tabular-nums}
.chip.dl.bad{color:var(--bad);opacity:1;font-weight:500}
.pdot{display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--c);margin-left:6px}
article li.task{margin-left:-28px;padding:6px 8px;margin-top:3px;margin-bottom:3px;line-height:1.5}article li.task p{margin:0}
article li.task:not(.task-add){cursor:pointer;border-radius:6px}article li.task.dragging{opacity:.4}
article li.task.drop-before{box-shadow:0 -2px 0 var(--accent)}article li.task.drop-after{box-shadow:0 2px 0 var(--accent)}
article li.task:not(.task-add){cursor:grab}article li.task:not(.task-add):active{cursor:grabbing}article li.task:not(.task-add):hover{background:var(--accent-soft)}
article li.task-add{opacity:.45;cursor:pointer;color:var(--muted)}article li.task-add:hover{opacity:.85}
.fbox{display:inline-block;width:16px;height:16px;margin:0 8px 0 0;vertical-align:-2px;border:2px solid currentColor;border-radius:4px;box-sizing:border-box}
.fold-h{cursor:pointer;user-select:none;display:flex;align-items:center;gap:10px}
.fold-h .chev{display:inline-block;font-size:.6em;color:var(--muted);transition:transform .15s;width:1em;text-align:center}.fold-h:not(.open) .chev{transform:rotate(-90deg)}
.fold-c{margin-left:auto;font-size:12px;font-weight:400;color:var(--muted);background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:1px 9px;font-family:inherit;letter-spacing:0}
h2.fold-h{padding:10px 14px;border:1px solid var(--line);border-radius:12px;background:var(--panel);margin-top:22px}
h3.fold-h{padding:7px 10px;border-radius:8px;margin-top:10px}.fold-h:hover{background:var(--accent-soft)}
.fold-body[hidden]{display:none}.fold-body{padding:2px 0 6px}
.fold-bar{display:flex;gap:6px;margin:10px 0 4px}.fold-bar button{font-size:12px;padding:3px 10px}
.dl-title{width:100%;box-sizing:border-box;padding:7px 9px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);font:inherit;font-size:16px;font-weight:500}
.dl-grid.two{grid-template-columns:1fr 1fr}
button.danger{color:var(--bad);border-color:transparent;background:none}button.danger:hover{background:var(--bad-soft)}
@media (max-width:760px){
  .b-top{padding:10px 12px}.b-body{padding:12px 12px 60px}
  .kanban{grid-template-columns:none;grid-auto-flow:column;grid-auto-columns:86%;overflow-x:auto;scroll-snap-type:x mandatory;gap:10px}
  .col{scroll-snap-align:start}.col .list{max-height:60vh}
  .wk{--lh:8px}.wk-days{min-height:calc(28px + var(--nl) * (var(--lh) + 2px))}.wk-bars{top:24px}
  .bar{font-size:0;padding:0;margin:0 1px}.bar::before{content:none!important}
  .day{padding:2px}.day .more{display:none}.bar2{width:110px}.legend{margin-left:0}
  .dl-grid{grid-template-columns:1fr 1fr}
}
@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto}}`;
document.head.appendChild(css);

window.VMBoard = {show, hide, decorate};
bind();
})();
