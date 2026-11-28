/* Sơ đồ kiểu Canva (2026-11-24, chủ nhà: "thêm tính năng tạo file sơ đồ như này giống Canva, công cụ tạo cũng y hệt, cách sử dụng cũng y hệt").
   Một sơ đồ là một khối ```vmdiagram (JSON) trong file Markdown:
     - File sơ đồ = "# Tên" + đúng một khối vmdiagram → mở ra là vẽ luôn (cả vùng bên phải).
     - Khối vmdiagram nằm trong tài liệu thường → hiện hình xem trước, bấm vào để vẽ toàn màn hình.
   Dữ liệu: {v:1, items:[…]} theo thứ tự lớp (dưới → trên):
     hình  {id, t:"s", shp: rect|round|pill|ellipse|diamond|triangle|hexagon|para|sticky|text, x, y, w, h (góc trên trái),
            txt, fill, stroke, sw (độ dày viền), dash, tc (màu chữ), fs (cỡ chữ), b, it (đậm / nghiêng), al l|c|r, aw (chữ tự rộng), lk (khoá)}
     đường {id, t:"l", a, b = {id, sd: t|r|b|l} (gắn vào cạnh một hình) hoặc {x, y} (đầu tự do),
            rt elbow|straight|curve, col, lw, dash, s / e = đầu / cuối: 0 không, 1 mũi tên đặc, 2 mũi tên nét, 3 chấm tròn, lbl, lfs, lk}
     nét vẽ tay {id, t:"d", pts:[[x,y]…], col, lw, lk}
   Dùng như Canva: thanh công cụ trái (Chọn V, Hình R / C, Đường L, Chữ T, Giấy note S, Bút vẽ D), chọn một hình → 4 nút + quanh hình
   (bấm = thêm hình nối, kéo = vẽ đường nối sang hình khác, thả ra chỗ trống = chọn hình để thêm), thanh công cụ nổi phía trên mục đang chọn,
   bấm đúp = gõ chữ (gõ phím khi đang chọn hình cũng được), bấm đúp đường = chữ trên đường, đường căn tím khi kéo, Ctrl+lăn chuột = thu phóng. */
(() => {
const NS = "http://www.w3.org/2000/svg";
const FONT = `"Be Vietnam Pro",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif`;
const SEL = "#8b3dff", GUIDE = "#ff3ea5", BG = "#ffffff", LH = 1.3;
const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const r1 = v => Math.round(v * 10) / 10;
const clone = o => JSON.parse(JSON.stringify(o));

const SHAPES = [["rect", "Chữ nhật"], ["round", "Bo góc"], ["pill", "Viên thuốc"], ["ellipse", "Elip / tròn"],
  ["diamond", "Hình thoi"], ["triangle", "Tam giác"], ["hexagon", "Lục giác"], ["para", "Hình bình hành"]];
const PALETTE = ["#000000", "#545454", "#737373", "#a6a6a6", "#d9d9d9", "#ffffff",
  "#ff3131", "#ff5757", "#ff66c4", "#cb6ce6", "#8c52ff", "#5e17eb",
  "#0097b2", "#0cc0df", "#5ce1e6", "#38b6ff", "#5271ff", "#004aad",
  "#00bf63", "#7ed957", "#c1ff72", "#ffde59", "#ffbd59", "#ff914d",
  "#1a5fbf", "#0d3a85", "#0d2f73", "#d6daf8", "#aedbff", "#fff1a8"];
const STICKY = ["#fff1a8", "#ffd6a5", "#ffc8dd", "#cdeac0", "#bde0fe", "#e2d4ff"];
const DEF_SHAPE = {fill: "#d6daf8", stroke: "#1f3f99", sw: 1.5, dash: 0, tc: "#0d2f73", fs: 22, b: 0, it: 0, al: "c"};
const DEF_LINE = {rt: "elbow", col: "#0d3a85", lw: 2.5, dash: 0, s: 0, e: 1, lbl: "", lfs: 20};
const SIZE = {rect: [300, 126], round: [300, 126], pill: [520, 116], ellipse: [340, 150], diamond: [260, 190], triangle: [240, 200],
  hexagon: [300, 150], para: [300, 126], sticky: [220, 220], text: [60, 30]};
const DIRV = {t: {x: 0, y: -1}, r: {x: 1, y: 0}, b: {x: 0, y: 1}, l: {x: -1, y: 0}}, OPP = {t: "b", b: "t", l: "r", r: "l"};

/* ---------------------------------------------------------------- hình học */
function outline(k, w, h) {
  switch (k) {
    case "ellipse": return `M0,${h / 2}a${w / 2},${h / 2} 0 1,0 ${w},0a${w / 2},${h / 2} 0 1,0 ${-w},0Z`;
    case "diamond": return `M${w / 2},0L${w},${h / 2}L${w / 2},${h}L0,${h / 2}Z`;
    case "triangle": return `M${w / 2},0L${w},${h}L0,${h}Z`;
    case "hexagon": return `M${w * .25},0H${w * .75}L${w},${h / 2}L${w * .75},${h}H${w * .25}L0,${h / 2}Z`;
    case "para": return `M${w * .2},0H${w}L${w * .8},${h}H0Z`;
  }
  const r = k === "pill" ? Math.min(w, h) / 2 : k === "round" ? Math.min(22, w / 4, h / 4) : k === "sticky" ? 4 : 0;
  if (!r) return `M0,0H${w}V${h}H0Z`;
  return `M${r},0H${w - r}A${r},${r} 0 0 1 ${w},${r}V${h - r}A${r},${r} 0 0 1 ${w - r},${h}H${r}A${r},${r} 0 0 1 0,${h - r}V${r}A${r},${r} 0 0 1 ${r},0Z`;
}
function inset(it) {                       // vùng chữ bên trong hình: l, r (px), t, b = ct + ft * h
  const w = it.w, h = it.h;
  const o = {rect: [18, 18, 10, 10, 0, 0], round: [18, 18, 10, 10, 0, 0], sticky: [18, 18, 16, 16, 0, 0], pill: [Math.max(h * .4, 18), Math.max(h * .4, 18), 8, 8, 0, 0],
    ellipse: [w * .15, w * .15, 2, 2, .13, .13], diamond: [w * .25, w * .25, 2, 2, .22, .22], triangle: [w * .25, w * .25, 2, 2, .45, .06],
    hexagon: [w * .2, w * .2, 8, 8, 0, 0], para: [w * .22, w * .22, 8, 8, 0, 0], text: [0, 0, 0, 0, 0, 0]}[it.shp] || [18, 18, 10, 10, 0, 0];
  return {l: o[0], r: o[1], ct: o[2], cb: o[3], ft: o[4], fb: o[5], t: o[2] + o[4] * h, b: o[3] + o[5] * h};
}
let mctx = null;
const fontOf = (fs, b, i) => `${i ? "italic " : ""}${b ? 700 : 400} ${fs}px ${FONT}`;
function measure(t, font) { mctx = mctx || document.createElement("canvas").getContext("2d"); mctx.font = font; return mctx.measureText(t).width; }
function wrap(txt, maxW, font) {
  const out = [];
  for (const para of String(txt || "").split("\n")) {
    if (!para.trim()) { out.push(""); continue; }
    let line = "";
    for (let word of para.split(/ +/)) {
      if (!word) continue;
      const test = line ? line + " " + word : word;
      if (measure(test, font) <= maxW) { line = test; continue; }
      if (line) { out.push(line); line = ""; }
      while (measure(word, font) > maxW && word.length > 1) {           // từ quá dài: cắt theo ký tự
        let k = word.length - 1; while (k > 1 && measure(word.slice(0, k), font) > maxW) k--;
        out.push(word.slice(0, k)); word = word.slice(k);
      }
      line = word;
    }
    out.push(line);
  }
  return out;
}
function layout(it) {
  const I = inset(it), font = fontOf(it.fs, it.b, it.it), maxW = Math.max(8, it.w - I.l - I.r);
  const lines = (it.txt || "") ? wrap(it.txt, maxW, font) : [], lh = it.fs * LH;
  return {I, font, lines, lh, textH: lines.length * lh};
}
function fit(it) {                         // chữ dài thì hình tự cao lên (như Canva); hộp chữ cao đúng bằng chữ
  const L = layout(it);
  if (it.shp === "text") {
    if (it.aw) {
      const nat = Math.max(...String(it.txt || "").split("\n").map(t => measure(t, L.font)), it.fs);
      it.w = Math.ceil(clamp(nat + 6, 30, 900));
    }
    it.h = Math.max(L.lh, layout(it).textH);
    return;
  }
  const need = (L.textH + L.I.ct + L.I.cb) / Math.max(.2, 1 - L.I.ft - L.I.fb);
  if (need > it.h + .5) it.h = Math.ceil(need);
}
function anchor(t, sd) {
  const cx = t.x + t.w / 2, cy = t.y + t.h / 2, side = t.shp === "triangle" ? t.w * .25 : t.shp === "para" ? t.w * .1 : 0;
  const p = sd === "t" ? {x: cx, y: t.y} : sd === "b" ? {x: cx, y: t.y + t.h} : sd === "l" ? {x: t.x + side, y: cy} : {x: t.x + t.w - side, y: cy};
  return {x: p.x, y: p.y, d: DIRV[sd] || DIRV.b};
}
function endPt(e, map) {
  if (!e) return null;
  if (e.id) { const t = map.get(e.id); return t && t.t === "s" ? anchor(t, e.sd) : null; }
  return e.x != null ? {x: e.x, y: e.y, d: null} : null;
}
function nearestSide(t, wx, wy) {
  const nx = (wx - t.x - t.w / 2) / (t.w / 2 || 1), ny = (wy - t.y - t.h / 2) / (t.h / 2 || 1);
  return Math.abs(nx) >= Math.abs(ny) ? (nx > 0 ? "r" : "l") : (ny > 0 ? "b" : "t");
}
const axis = v => (Math.abs(v.x) >= Math.abs(v.y) ? {x: Math.sign(v.x) || 1, y: 0} : {x: 0, y: Math.sign(v.y) || 1});
const unit = (x, y) => { const d = Math.hypot(x, y) || 1; return {x: x / d, y: y / d}; };
function simplify(p) {
  const o = [];
  for (const q of p) { const l = o[o.length - 1]; if (l && Math.abs(l.x - q.x) < .01 && Math.abs(l.y - q.y) < .01) continue; o.push({x: q.x, y: q.y}); }
  for (let i = o.length - 2; i > 0; i--) { const a = o[i - 1], b = o[i], c = o[i + 1]; if (Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) < .01) o.splice(i, 1); }
  return o;
}
/* đường đi của một đường nối: gấp khúc tự chọn đường như Canva, thẳng, hoặc cong */
function route(l, map) {
  const A = endPt(l.a, map), B = endPt(l.b, map); if (!A || !B) return null;
  const G = 28; let da = A.d ? axis(A.d) : null, db = B.d ? axis(B.d) : null;
  if (!da && !db) { da = axis({x: B.x - A.x, y: B.y - A.y}); db = {x: -da.x, y: -da.y}; }
  else if (!da) da = axis({x: B.x - A.x, y: B.y - A.y}); else if (!db) db = axis({x: A.x - B.x, y: A.y - B.y});
  const rt = l.rt || "elbow"; let pts, c1, c2;
  if (rt === "straight") pts = [A, B];
  else if (rt === "curve") {
    const k = Math.max(40, Math.hypot(B.x - A.x, B.y - A.y) * .4);
    c1 = {x: A.x + da.x * k, y: A.y + da.y * k}; c2 = {x: B.x + db.x * k, y: B.y + db.y * k};
    pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24, u = 1 - t;
      pts.push({x: u * u * u * A.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * B.x, y: u * u * u * A.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * B.y}); }
  } else {
    const p1 = {x: A.x + da.x * G, y: A.y + da.y * G}, p2 = {x: B.x + db.x * G, y: B.y + db.y * G}, va = da.y !== 0, vb = db.y !== 0;
    if (va && vb) {
      if (da.y === db.y) { const y = da.y > 0 ? Math.max(p1.y, p2.y) : Math.min(p1.y, p2.y); pts = [A, {x: A.x, y}, {x: B.x, y}, B]; }
      else if (Math.sign(B.y - A.y) === da.y && Math.abs(B.y - A.y) >= G) { const y = (A.y + B.y) / 2; pts = [A, {x: A.x, y}, {x: B.x, y}, B]; }
      else { const x = (A.x + B.x) / 2; pts = [A, p1, {x, y: p1.y}, {x, y: p2.y}, p2, B]; }
    } else if (!va && !vb) {
      if (da.x === db.x) { const x = da.x > 0 ? Math.max(p1.x, p2.x) : Math.min(p1.x, p2.x); pts = [A, {x, y: A.y}, {x, y: B.y}, B]; }
      else if (Math.sign(B.x - A.x) === da.x && Math.abs(B.x - A.x) >= G) { const x = (A.x + B.x) / 2; pts = [A, {x, y: A.y}, {x, y: B.y}, B]; }
      else { const y = (A.y + B.y) / 2; pts = [A, p1, {x: p1.x, y}, {x: p2.x, y}, p2, B]; }
    } else if (va) {
      const ok = Math.sign(B.y - A.y) === da.y && Math.sign(A.x - B.x) === db.x;
      pts = ok ? [A, {x: A.x, y: B.y}, B] : [A, p1, {x: p2.x, y: p1.y}, p2, B];
    } else {
      const ok = Math.sign(B.x - A.x) === da.x && Math.sign(A.y - B.y) === db.y;
      pts = ok ? [A, {x: B.x, y: A.y}, B] : [A, p1, {x: p1.x, y: p2.y}, p2, B];
    }
    pts = simplify(pts);
  }
  const n = pts.length;
  const ub = c2 ? unit(B.x - c2.x, B.y - c2.y) : unit(B.x - pts[n - 2].x, B.y - pts[n - 2].y);
  const ua = c1 ? unit(A.x - c1.x, A.y - c1.y) : unit(A.x - pts[1].x, A.y - pts[1].y);
  let tot = 0; const seg = []; for (let i = 1; i < n; i++) { const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); seg.push(d); tot += d; }
  let half = tot / 2, mid = {x: (A.x + B.x) / 2, y: (A.y + B.y) / 2};
  for (let i = 0; i < seg.length; i++) { if (half <= seg[i]) { const k = seg[i] ? half / seg[i] : 0; mid = {x: pts[i].x + (pts[i + 1].x - pts[i].x) * k, y: pts[i].y + (pts[i + 1].y - pts[i].y) * k}; break; } half -= seg[i]; }
  return {A, B, pts, c1, c2, ua, ub, mid};
}
const headLen = lw => 9 + lw * 2.4;
function linePath(l, R) {                  // đường (góc gấp khúc bo tròn như Canva), cắt bớt chỗ mũi tên
  const al = headLen(l.lw), cutA = l.s === 1 ? al * .8 : l.s === 3 ? 3 + l.lw : 0, cutB = l.e === 1 ? al * .8 : l.e === 3 ? 3 + l.lw : 0;
  const A = {x: R.A.x - R.ua.x * cutA, y: R.A.y - R.ua.y * cutA}, B = {x: R.B.x - R.ub.x * cutB, y: R.B.y - R.ub.y * cutB};
  const f = p => `${r1(p.x)},${r1(p.y)}`;
  if (R.c1) return `M${f(A)}C${f(R.c1)} ${f(R.c2)} ${f(B)}`;
  const p = R.pts.slice(); p[0] = A; p[p.length - 1] = B;
  let d = "M" + f(p[0]);
  for (let i = 1; i < p.length - 1; i++) {
    const a = p[i - 1], c = p[i], b = p[i + 1], la = Math.hypot(c.x - a.x, c.y - a.y), lb = Math.hypot(b.x - c.x, b.y - c.y), r = Math.min(12, la / 2, lb / 2);
    const u1 = unit(c.x - a.x, c.y - a.y), u2 = unit(b.x - c.x, b.y - c.y);
    d += `L${f({x: c.x - u1.x * r, y: c.y - u1.y * r})}Q${f(c)} ${f({x: c.x + u2.x * r, y: c.y + u2.y * r})}`;
  }
  return d + "L" + f(p[p.length - 1]);
}
function headSVG(kind, P, u, l) {
  if (!kind) return "";
  const al = headLen(l.lw), b = {x: P.x - u.x * al, y: P.y - u.y * al}, n = {x: -u.y * al * .5, y: u.x * al * .5};
  if (kind === 1) return `<path d="M${r1(P.x)},${r1(P.y)}L${r1(b.x + n.x)},${r1(b.y + n.y)}L${r1(b.x - n.x)},${r1(b.y - n.y)}Z" fill="${l.col}" stroke="${l.col}" stroke-width="${l.lw * .6}" stroke-linejoin="round"/>`;
  if (kind === 2) return `<path d="M${r1(b.x + n.x)},${r1(b.y + n.y)}L${r1(P.x)},${r1(P.y)}L${r1(b.x - n.x)},${r1(b.y - n.y)}" fill="none" stroke="${l.col}" stroke-width="${l.lw}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const r = 3 + l.lw; return `<circle cx="${r1(P.x - u.x * r)}" cy="${r1(P.y - u.y * r)}" r="${r}" fill="${l.col}"/>`;
}
function labelBox(l, R) {
  if (!l.lbl) return null;
  const font = fontOf(l.lfs || 20, 0, 0), lines = String(l.lbl).split("\n"), lh = (l.lfs || 20) * LH;
  const w = Math.max(...lines.map(t => measure(t, font))) + 12, h = lines.length * lh + 4;
  return {x0: R.mid.x - w / 2, y0: R.mid.y - h / 2, x1: R.mid.x + w / 2, y1: R.mid.y + h / 2, lines, lh};
}
function bbox(it, map) {
  if (it.t === "s") return {x0: it.x, y0: it.y, x1: it.x + it.w, y1: it.y + it.h};
  if (it.t === "d") { const xs = it.pts.map(p => p[0]), ys = it.pts.map(p => p[1]), m = it.lw / 2; return {x0: Math.min(...xs) - m, y0: Math.min(...ys) - m, x1: Math.max(...xs) + m, y1: Math.max(...ys) + m}; }
  const R = route(it, map); if (!R) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of R.pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  const lb = labelBox(it, R); if (lb) { x0 = Math.min(x0, lb.x0); y0 = Math.min(y0, lb.y0); x1 = Math.max(x1, lb.x1); y1 = Math.max(y1, lb.y1); }
  return {x0, y0, x1, y1};
}
function union(list, map) {
  let b = null;
  for (const it of list) { const q = bbox(it, map); if (!q) continue; b = b ? {x0: Math.min(b.x0, q.x0), y0: Math.min(b.y0, q.y0), x1: Math.max(b.x1, q.x1), y1: Math.max(b.y1, q.y1)} : {...q}; }
  return b;
}
const idMap = items => new Map(items.map(i => [i.id, i]));

/* ---------------------------------------------------------------- vẽ ra SVG (dùng chung cho bảng vẽ, xem trước, xuất PNG) */
function shapeSVG(it, hideText) {
  const L = layout(it), k = it.shp;
  let s = `<g data-id="${it.id}" transform="translate(${r1(it.x)},${r1(it.y)})">`;
  if (k === "text") s += `<rect width="${r1(it.w)}" height="${r1(it.h)}" fill="transparent" pointer-events="all"/>`;
  else {
    const fill = it.fill && it.fill !== "none" ? it.fill : "none", stroke = it.sw > 0 && it.stroke && it.stroke !== "none" ? it.stroke : "none";
    s += `<path d="${outline(k, r1(it.w), r1(it.h))}" fill="${fill}" stroke="${stroke}" stroke-width="${it.sw || 0}"${it.dash ? ` stroke-dasharray="${it.sw * 4} ${it.sw * 3}"` : ""} stroke-linejoin="round" pointer-events="all"${k === "sticky" ? ' filter="url(#dgShadow)"' : ""}/>`;
  }
  if (!hideText && L.lines.length) {
    const I = L.I, x0 = I.l, x1 = it.w - I.r, top = I.t + (it.h - I.t - I.b - L.textH) / 2;
    const ax = it.al === "l" ? x0 : it.al === "r" ? x1 : (x0 + x1) / 2, anc = it.al === "l" ? "start" : it.al === "r" ? "end" : "middle";
    s += `<text font-family='${FONT}' font-size="${it.fs}" font-weight="${it.b ? 700 : 400}"${it.it ? ' font-style="italic"' : ""} fill="${it.tc}" text-anchor="${anc}" pointer-events="none">`;
    L.lines.forEach((t, i) => { s += `<tspan x="${r1(ax)}" y="${r1(top + i * L.lh + L.lh / 2 + it.fs * .36)}">${esc(t) || " "}</tspan>`; });
    s += "</text>";
  }
  return s + "</g>";
}
function lineSVG(l, map) {
  const R = route(l, map); if (!R) return "";
  const d = linePath(l, R), dash = l.dash ? ` stroke-dasharray="${l.lw * 3} ${l.lw * 2.4}"` : "";
  let s = `<g data-id="${l.id}"><path d="${d}" fill="none" stroke="transparent" stroke-width="${l.lw + 16}" pointer-events="stroke"/>`;
  s += `<path d="${d}" fill="none" stroke="${l.col}" stroke-width="${l.lw}" stroke-linecap="round" stroke-linejoin="round"${dash} pointer-events="none"/>`;
  s += headSVG(l.e, R.B, R.ub, l) + headSVG(l.s, R.A, R.ua, l);
  const lb = labelBox(l, R);
  if (lb) {
    s += `<rect x="${r1(lb.x0)}" y="${r1(lb.y0)}" width="${r1(lb.x1 - lb.x0)}" height="${r1(lb.y1 - lb.y0)}" rx="4" fill="${BG}" pointer-events="all"/>`;
    s += `<text font-family='${FONT}' font-size="${l.lfs || 20}" fill="${l.col}" text-anchor="middle" pointer-events="none">`;
    lb.lines.forEach((t, i) => { s += `<tspan x="${r1(R.mid.x)}" y="${r1(lb.y0 + 2 + i * lb.lh + lb.lh / 2 + (l.lfs || 20) * .36)}">${esc(t) || " "}</tspan>`; });
    s += "</text>";
  }
  return s + "</g>";
}
function penPath(pts) {
  if (pts.length < 2) { const p = pts[0] || [0, 0]; return `M${p[0]},${p[1]}l.01,0`; }
  let d = `M${r1(pts[0][0])},${r1(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) { const m = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2]; d += `Q${r1(pts[i][0])},${r1(pts[i][1])} ${r1(m[0])},${r1(m[1])}`; }
  const q = pts[pts.length - 1]; return d + `L${r1(q[0])},${r1(q[1])}`;
}
function penSVG(it) {
  const d = penPath(it.pts);
  return `<g data-id="${it.id}"><path d="${d}" fill="none" stroke="transparent" stroke-width="${it.lw + 14}" stroke-linecap="round" pointer-events="stroke"/><path d="${d}" fill="none" stroke="${it.col}" stroke-width="${it.lw}" stroke-linecap="round" stroke-linejoin="round" pointer-events="none"/></g>`;
}
const DEFS = `<defs><filter id="dgShadow" x="-10%" y="-10%" width="130%" height="140%"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000" flood-opacity=".18"/></filter></defs>`;
function itemsSVG(items, hideTextId) {
  const map = idMap(items); let s = "";
  for (const it of items) s += it.t === "s" ? shapeSVG(it, it.id === hideTextId) : it.t === "l" ? lineSVG(it, map) : it.t === "d" ? penSVG(it) : "";
  return s;
}
function svgString(items, pad = 40, scale = 1) {
  items.forEach(i => { if (i.t === "s") fit(i); });
  const b = union(items, idMap(items)) || {x0: 0, y0: 0, x1: 400, y1: 240};
  const x = b.x0 - pad, y = b.y0 - pad, w = b.x1 - b.x0 + pad * 2, h = b.y1 - b.y0 + pad * 2;
  return {w, h, svg: `<svg xmlns="${NS}" width="${r1(w * scale)}" height="${r1(h * scale)}" viewBox="${r1(x)} ${r1(y)} ${r1(w)} ${r1(h)}">${DEFS}<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" fill="${BG}"/>${itemsSVG(items)}</svg>`};
}
async function downloadPng(items, name) {
  if (!items.length) return;
  const {w, h, svg} = svgString(clone(items), 40, 1), k = clamp(2400 / Math.max(w, h), 1, 3);
  const url = URL.createObjectURL(new Blob([svg], {type: "image/svg+xml;charset=utf-8"}));
  try {
    const img = new Image(); img.src = url; await img.decode();
    const c = document.createElement("canvas"); c.width = Math.round(w * k); c.height = Math.round(h * k);
    const ctx = c.getContext("2d"); ctx.fillStyle = BG; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, "image/png"));
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = (String(name || "so-do").replace(/[\\/:*?"<>|]+/g, " ").trim() || "so-do") + ".png"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } finally { URL.revokeObjectURL(url); }
}

/* ---------------------------------------------------------------- dữ liệu trong Markdown */
const FENCE = /^```vmdiagram[^\n]*\n([\s\S]*?)\n?```[ \t]*$/gm;
function normalize(items) {
  const out = [];
  for (const raw of Array.isArray(items) ? items : []) {
    if (!raw || typeof raw !== "object") continue;
    const it = {...raw}; it.id = String(it.id || uid());
    if (it.t === "s") {
      Object.assign(it, {...DEF_SHAPE, ...it}); it.shp = it.shp || "round";
      for (const k of ["x", "y", "w", "h", "fs", "sw"]) it[k] = Number(it[k]) || 0;
      it.w = Math.max(it.w, 10); it.h = Math.max(it.h, 10); it.fs = it.fs || 22; it.txt = String(it.txt ?? "");
    } else if (it.t === "l") {
      Object.assign(it, {...DEF_LINE, ...it});
      if (!it.a || !it.b) continue;
    } else if (it.t === "d") {
      if (!Array.isArray(it.pts) || !it.pts.length) continue; it.col = it.col || "#000000"; it.lw = Number(it.lw) || 4;
    } else continue;
    out.push(it);
  }
  const ids = new Set(out.map(i => i.id));
  return out.filter(l => l.t !== "l" || ((!l.a.id || ids.has(l.a.id)) && (!l.b.id || ids.has(l.b.id))));
}
function parse(json) { try { const d = JSON.parse(json); return {v: 1, items: normalize(d && d.items)}; } catch { return {v: 1, items: [], bad: true}; } }
function roundItem(it) {
  const o = {};
  for (const [k, v] of Object.entries(it)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "number") o[k] = r1(v);
    else if (k === "pts") o[k] = v.map(p => [r1(p[0]), r1(p[1])]);
    else if ((k === "a" || k === "b") && v.x != null) o[k] = {x: r1(v.x), y: r1(v.y)};
    else o[k] = v;
  }
  return o;
}
function serialize(data) { return '{"v":1,"items":[\n' + (data.items || []).map(i => JSON.stringify(roundItem(i))).join(",\n") + "\n]}"; }
const block = data => "```vmdiagram\n" + serialize(data) + "\n```";
function blocks(text) { const out = []; let m; FENCE.lastIndex = 0; while ((m = FENCE.exec(text))) out.push({start: m.index, end: m.index + m[0].length, json: m[1]}); return out; }
function replaceBlock(text, k, data) {
  if (!data) return text;
  const b = blocks(text)[k]; if (!b) return text.replace(/\s*$/, "\n\n") + block(data) + "\n";
  return text.slice(0, b.start) + block(data) + text.slice(b.end);
}
function setTitle(text, title) {
  if (title == null) return text;
  const t = String(title).replace(/\s+/g, " ").trim() || "Sơ đồ";
  return /^# .*/m.test(text) ? text.replace(/^# .*/m, "# " + t) : "# " + t + "\n\n" + text;
}
function isFile(text) {
  const rest = String(text || "").replace(/^﻿?#[^\n]*\n/, "").trim();
  const b = blocks(rest); return b.length === 1 && b[0].start === 0 && b[0].end === rest.length;
}
const titleOf = text => ((/^# (.*)/m.exec(text || "") || [])[1] || "").trim();

/* sơ đồ mẫu giống ảnh chủ nhà gửi: ý chính (elip) → 3 nhánh (viên thuốc) → nhánh giữa có 2 ý con, đường gấp khúc có chữ */
function template(rootText, ox = 0, oy = 0) {
  const S = (shp, txt, x, y, w, h, st) => ({id: uid(), t: "s", shp, txt, x: x + ox, y: y + oy, w, h, ...DEF_SHAPE, ...st});
  const root = S("ellipse", rootText || "Ý TƯỞNG CHÍNH", 1083, 137, 354, 152, {fill: "#1a5fbf", stroke: "#1a5fbf", sw: 0, tc: "#ffffff", fs: 30, b: 1});
  const pillSt = {fill: "#d6daf8", stroke: "#1f3f99", sw: 1.5, tc: "#0d2f73", fs: 30, b: 1}, boxSt = {fill: "#aedbff", stroke: "#2563c9", sw: 1.5, tc: "#0d2f73", fs: 22, b: 0};
  const p = [S("pill", "NHÁNH 1", 86, 506, 524, 116, pillSt), S("pill", "NHÁNH 2", 998, 506, 524, 116, pillSt), S("pill", "NHÁNH 3", 2003, 506, 524, 116, pillSt)];
  const c = [S("rect", "Thêm ý tưởng liên quan", 754, 977, 302, 126, boxSt), S("rect", "Thêm ý tưởng liên quan", 1464, 977, 302, 126, boxSt)];
  const L = (a, b, lbl) => ({id: uid(), t: "l", ...DEF_LINE, a: {id: a.id, sd: "b"}, b: {id: b.id, sd: "t"}, lbl: lbl || "", lfs: 22});
  return [L(root, p[0]), L(root, p[1]), L(root, p[2]), L(p[1], c[0], "Mô tả mối quan hệ"), L(p[1], c[1], "Mối quan hệ"), root, ...p, ...c];
}
/* mẫu "4 góc + trung tâm" (chủ nhà 28/11, theo ảnh bảng so sánh Harry Potter): 4 ô ở 4 góc chạm vào góc của 1 ô giữa; ô để trống, bấm vào để gõ */
function template4(ox = 0, oy = 0) {
  const st = {fill: "#ffffff", stroke: "#1f2a44", sw: 2, tc: "#1f2a44", fs: 22, b: 0};
  const S = (x, y, w, h, al) => ({id: uid(), t: "s", shp: "rect", txt: "", x: x + ox, y: y + oy, w, h, ...DEF_SHAPE, ...st, al});
  const W = 380, H = 150, CH = 90;                                     // ô góc rộng W cao H, ô giữa rộng W cao CH
  return [S(0, 0, W, H, "l"), S(2 * W, 0, W, H, "l"), S(W, H, W, CH, "c"), S(0, H + CH, W, H, "l"), S(2 * W, H + CH, W, H, "l")];
}
function newFileText(title, withTemplate) {
  const items = withTemplate ? template(String(title || "").toUpperCase()) : [];
  return `# ${title}\n\n${block({items})}\n`;
}

/* ---------------------------------------------------------------- biểu tượng */
const IC = {
  select: '<path d="M5 3l14 8-6 1.6L10 19z"/>',
  shape: '<rect x="3" y="11" width="9" height="9" rx="1"/><circle cx="16" cy="8" r="5"/>',
  line: '<path d="M4 20c0-8 4-9 9-9h4"/><path d="M15 7l4 4-4 4"/>',
  text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
  sticky: '<path d="M4 4h16v10l-6 6H4z"/><path d="M14 20v-6h6"/>',
  pen: '<path d="M4 20l4-1L19 8l-3-3L5 16z"/><path d="M14 7l3 3"/>',
  tpl: '<rect x="8" y="2" width="8" height="5" rx="2.5"/><rect x="2" y="16" width="7" height="5" rx="1"/><rect x="15" y="16" width="7" height="5" rx="1"/><path d="M12 7v4H5.5v5M12 11h6.5v5"/>',
  hand: '<path d="M8 13V5.5a1.5 1.5 0 013 0V12m0-1V4.5a1.5 1.5 0 013 0V12m0-6.5a1.5 1.5 0 013 0V14a6 6 0 01-6 6h-1a6 6 0 01-5-2.7L3.6 13.6a1.5 1.5 0 012.4-1.8L8 14"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-2"/>', redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 000 12h2"/>',
  dup: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
  unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 017.5-2"/>', more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  alL: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>', alC: '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>', alR: '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',
  elbow: '<path d="M4 19v-7h16V5"/>', straight: '<path d="M4 19L20 5"/>', curve: '<path d="M4 19C12 19 12 5 20 5"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', png: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', close: '<path d="M15 5l-7 7 7 7"/>',
  key: '<rect x="2" y="6" width="20" height="13" rx="2"/><path d="M6 10h1M10 10h1M14 10h1M18 10h1M7 15h10"/>', label: '<path d="M3 12h4M17 12h4"/><path d="M9 9V8h6v1M12 8v8M10.5 16h3"/>',
};
const svgI = (k, extra = "") => `<svg viewBox="0 0 24 24" class="ic" ${extra}>${IC[k]}</svg>`;
const shpIcon = k => `<svg viewBox="0 0 44 30" class="shi"><path d="${outline(k, 40, 26)}" transform="translate(2,2)"/></svg>`;
const endIcon = (k, start) => {
  const l = {lw: 2, col: "currentColor"}, P = start ? {x: 6, y: 12} : {x: 34, y: 12}, u = start ? {x: -1, y: 0} : {x: 1, y: 0};
  return `<svg viewBox="0 0 40 24" class="shi"><path d="M6 12h28" stroke="currentColor" stroke-width="2" fill="none"/>${headSVG(k, P, u, l)}</svg>`;
};

/* ---------------------------------------------------------------- trình vẽ */
let active = null;                          // trình vẽ đang dùng phím tắt
function mount(host, opts = {}) {
  let items = normalize(clone((opts.data && opts.data.items) || []));
  let view = {x: 0, y: 0, z: 1}, sel = new Set(), tool = "select", toolArg = null, hover = null, editingId = null;
  let drag = null, guides = [], undo = [], redo = [], last = JSON.stringify(items), space = false, saveT = null, pending = null, destroyed = false;
  const pointers = new Map(); let lastTap = null;
  let lineStyle = {...DEF_LINE}, penStyle = {col: "#1f2a44", lw: 4}, stickyCol = STICKY[0];

  host.innerHTML = "";
  const root = document.createElement("div"); root.className = "dg-root" + (opts.full ? " dg-full" : "");
  root.innerHTML = `
  <div class="dg-top">
    ${opts.onClose ? `<button type="button" class="dg-b dg-back" data-a="close" title="Xong, quay lại tài liệu (Esc khi không chọn gì)">${svgI("close")}<span>Xong</span></button>` : ""}
    ${opts.title != null ? `<input class="dg-title" maxlength="120" aria-label="Tên sơ đồ" title="Tên sơ đồ (bấm để đổi)">` : `<b class="dg-name">Sơ đồ</b>`}
    <span class="dg-vsep"></span>
    <button type="button" class="dg-b" data-a="undo" title="Hoàn tác (Ctrl+Z)">${svgI("undo")}</button>
    <button type="button" class="dg-b" data-a="redo" title="Làm lại (Ctrl+Y)">${svgI("redo")}</button>
    <span class="dg-status" aria-live="polite"></span>
    <span class="dg-sp"></span>
    <button type="button" class="dg-b" data-a="help" title="Cách dùng và phím tắt">${svgI("key")}<span>Phím tắt</span></button>
    <button type="button" class="dg-b" data-a="png" title="Tải sơ đồ về máy thành ảnh PNG">${svgI("png")}<span>Tải PNG</span></button>
  </div>
  <div class="dg-stage" tabindex="0">
    <svg class="dg-svg" xmlns="${NS}">${DEFS}<g class="dg-vp"><g class="dg-items"></g><g class="dg-ui"></g></g></svg>
    <div class="dg-tools" role="toolbar" aria-label="Công cụ vẽ">
      <button type="button" data-tool="select" title="Chọn (V)">${svgI("select")}<span>Chọn</span></button>
      <button type="button" data-tool="shape" title="Hình (R chữ nhật, C tròn)">${svgI("shape")}<span>Hình</span></button>
      <button type="button" data-tool="line" title="Đường nối (L)">${svgI("line")}<span>Đường</span></button>
      <button type="button" data-tool="text" title="Chữ (T)">${svgI("text")}<span>Chữ</span></button>
      <button type="button" data-tool="sticky" title="Giấy note (S)">${svgI("sticky")}<span>Note</span></button>
      <button type="button" data-tool="pen" title="Bút vẽ (D)">${svgI("pen")}<span>Vẽ</span></button>
      <span class="dg-hsep"></span>
      <button type="button" data-tool="tpl" title="Thêm sơ đồ mẫu: ý chính → 3 nhánh, hoặc 4 góc + ô trung tâm">${svgI("tpl")}<span>Mẫu</span></button>
    </div>
    <div class="dg-ctx" hidden></div>
    <div class="dg-pop" hidden></div>
    <div class="dg-menu" hidden></div>
    <div class="dg-hint" hidden></div>
    <div class="dg-empty" hidden><b>Sơ đồ trống</b><span>Chọn <b>Hình</b> bên trái rồi bấm vào trang, hoặc bấm <b>Mẫu</b> để chọn sơ đồ mẫu có sẵn.</span></div>
    <div class="dg-zoom">
      <button type="button" data-a="zout" title="Thu nhỏ (Ctrl −)">−</button><button type="button" data-a="z100" class="dg-zl" title="Về 100% (Ctrl+0)">100%</button><button type="button" data-a="zin" title="Phóng to (Ctrl +)">+</button>
      <button type="button" data-a="fit" title="Xem toàn bộ (Shift+1)">${svgI("fit")}</button>
    </div>
    <div class="dg-edit" hidden><div class="dg-ed" spellcheck="false"></div></div>
    <input class="dg-lbl" hidden maxlength="200" placeholder="Chữ trên đường nối">
  </div>`;
  host.appendChild(root);
  const q = s => root.querySelector(s);
  const stage = q(".dg-stage"), svg = q(".dg-svg"), gVp = q(".dg-vp"), gItems = q(".dg-items"), gUI = q(".dg-ui");
  const ctxBar = q(".dg-ctx"), pop = q(".dg-pop"), menu = q(".dg-menu"), hint = q(".dg-hint"), edWrap = q(".dg-edit"), ed = q(".dg-ed"), lblIn = q(".dg-lbl");
  const titleIn = q(".dg-title");
  if (titleIn) titleIn.value = opts.title || "";
  try { ed.contentEditable = "plaintext-only"; } catch {} if (ed.contentEditable !== "plaintext-only") ed.contentEditable = "true";

  const get = id => items.find(i => i.id === id);
  const map = () => idMap(items);
  const selList = () => items.filter(i => sel.has(i.id));
  const status = t => { q(".dg-status").textContent = t || ""; };
  const toWorld = e => { const r = svg.getBoundingClientRect(); return {x: (e.clientX - r.left - view.x) / view.z, y: (e.clientY - r.top - view.y) / view.z}; };
  const toScreen = (x, y) => ({x: x * view.z + view.x, y: y * view.z + view.y});

  /* ---------- lưu, hoàn tác ---------- */
  function emit() {
    if (!opts.save) return;
    pending = {v: 1, items: clone(items)}; status("Đang lưu…"); clearTimeout(saveT);
    saveT = setTimeout(flush, opts.saveDelay || 700);
  }
  async function flush() {
    clearTimeout(saveT); if (!pending || !opts.save) return;
    const d = pending; pending = null;
    try { await opts.save(d); if (!pending) status("Đã lưu"); }
    catch (e) { status("Chưa lưu được"); console.error(e); }
  }
  function commit() {
    const now = JSON.stringify(items); if (now === last) return;
    undo.push(last); if (undo.length > 150) undo.shift(); redo = []; last = now; emit(); syncTop();
  }
  function restore(s) { items = JSON.parse(s); last = s; sel = new Set([...sel].filter(id => get(id))); render(); emit(); syncTop(); }
  function doUndo() { if (editingId) finishEdit(); if (!undo.length) return; redo.push(last); restore(undo.pop()); }
  function doRedo() { if (!redo.length) return; undo.push(last); restore(redo.pop()); }
  function syncTop() { q('[data-a="undo"]').disabled = !undo.length; q('[data-a="redo"]').disabled = !redo.length; }

  /* ---------- vẽ ---------- */
  function render() {
    if (destroyed) return;
    for (const it of items) if (it.t === "s") fit(it);
    gItems.innerHTML = itemsSVG(items, editingId);
    q(".dg-empty").hidden = !!items.length || tool !== "select";
    renderUI(); applyView(); placeCtx();
  }
  function applyView() {
    gVp.setAttribute("transform", `translate(${r1(view.x)},${r1(view.y)}) scale(${view.z})`);
    let g = 22 * view.z; while (g < 12) g *= 4; stage.style.backgroundSize = `${g}px ${g}px`; stage.style.backgroundPosition = `${view.x}px ${view.y}px`;
    q(".dg-zl").textContent = Math.round(view.z * 100) + "%";
    if (editingId) placeEdit();
  }
  const hs = () => 1 / view.z;
  function inText(it, w) {                  // điểm (toạ độ bảng) nằm trong vùng chữ của hình
    if (!it || it.t !== "s" || it.lk) return false;
    const I = inset(it); return w.x >= it.x + I.l && w.x <= it.x + it.w - I.r && w.y >= it.y + I.t && w.y <= it.y + it.h - I.b;
  }
  function renderUI() {
    const z = hs(), M = map(); let s = "";
    const L = selList();
    if (drag && drag.type === "marquee" && drag.box) { const b = drag.box; s += `<rect x="${b.x0}" y="${b.y0}" width="${b.x1 - b.x0}" height="${b.y1 - b.y0}" fill="${SEL}" fill-opacity=".08" stroke="${SEL}" stroke-width="${z}"/>`; }
    for (const g of guides) s += `<line x1="${g[0]}" y1="${g[1]}" x2="${g[2]}" y2="${g[3]}" stroke="${GUIDE}" stroke-width="${z}" stroke-dasharray="${4 * z} ${3 * z}"/>`;
    if (hover && !sel.has(hover) && get(hover) && !drag) { const b = bbox(get(hover), M); if (b) s += `<rect x="${b.x0}" y="${b.y0}" width="${b.x1 - b.x0}" height="${b.y1 - b.y0}" fill="none" stroke="${SEL}" stroke-width="${1.5 * z}" pointer-events="none"/>`; }
    if (L.length) {
      const showBox = !(drag && drag.type === "pen");
      if (L.length > 1) for (const it of L) { const b = bbox(it, M); if (b) s += `<rect x="${b.x0}" y="${b.y0}" width="${b.x1 - b.x0}" height="${b.y1 - b.y0}" fill="none" stroke="${SEL}" stroke-width="${z}" pointer-events="none"/>`; }
      const one = L.length === 1 ? L[0] : null;
      if (one && one.t === "l") {
        const R = route(one, M);
        if (R) {
          s += `<path d="${linePath(one, R)}" fill="none" stroke="${SEL}" stroke-width="${1.5 * z}" stroke-dasharray="${5 * z} ${4 * z}" pointer-events="none"/>`;
          if (!one.lk) for (const [end, P] of [["a", R.A], ["b", R.B]]) s += `<circle data-end="${end}" cx="${P.x}" cy="${P.y}" r="${7 * z}" fill="#fff" stroke="${SEL}" stroke-width="${2 * z}" style="cursor:move"/>`;
        }
      } else if (showBox) {
        const b = union(L, M);
        if (b) {
          s += `<rect x="${b.x0}" y="${b.y0}" width="${b.x1 - b.x0}" height="${b.y1 - b.y0}" fill="none" stroke="${SEL}" stroke-width="${2 * z}" pointer-events="none"/>`;
          if (one && !one.lk && !editingId && (one.t === "s" || one.t === "d")) s += handles(one, b, z);
          if (one && one.t === "s" && !one.lk && !editingId && !drag && !(one.txt || "").trim()) {   // hình trống: dấu nháy nhấp nháy ở chỗ gõ chữ
            const I = inset(one), cx = one.shp === "text" ? one.x + 2 : one.x + I.l + (one.w - I.l - I.r) / 2, cy = one.y + I.t + (one.h - I.t - I.b) / 2, hh = one.fs * .62;
            s += `<line class="dg-caret" x1="${cx}" y1="${cy - hh}" x2="${cx}" y2="${cy + hh}" stroke="${SEL}" stroke-width="${Math.max(1.5, 2 * z)}" pointer-events="none"/>`;
          }
        }
      }
    }
    const cn = connTarget();
    if (cn) s += connDots(cn, z);
    if (drag && drag.temp) s += drag.temp;
    if (drag && drag.hot) { const t = get(drag.hot); if (t) s += `<rect x="${t.x - 4 * z}" y="${t.y - 4 * z}" width="${t.w + 8 * z}" height="${t.h + 8 * z}" rx="${6 * z}" fill="none" stroke="${SEL}" stroke-width="${2.5 * z}" pointer-events="none"/>`; }
    gUI.innerHTML = s;
    if (L.length === 1 && L[0].lk && !drag) { const b = bbox(L[0], M); if (b) gUI.insertAdjacentHTML("beforeend", `<g transform="translate(${b.x1 + 6 * z},${b.y0 - 22 * z}) scale(${z * .8})"><rect width="22" height="22" rx="5" fill="${SEL}"/><g transform="translate(3,3) scale(.67)" stroke="#fff" fill="none" stroke-width="2.4">${IC.lock}</g></g>`); }
  }
  function handles(it, b, z) {
    const xs = [b.x0, (b.x0 + b.x1) / 2, b.x1], ys = [b.y0, (b.y0 + b.y1) / 2, b.y1];
    const H = [["nw", 0, 0], ["ne", 2, 0], ["se", 2, 2], ["sw", 0, 2]];
    const sides = it.shp === "text" ? [["e", 2, 1], ["w", 0, 1]] : [["n", 1, 0], ["e", 2, 1], ["s", 1, 2], ["w", 0, 1]];
    let s = "";
    const cur = {nw: "nwse", se: "nwse", ne: "nesw", sw: "nesw", n: "ns", s: "ns", e: "ew", w: "ew"};
    for (const [h, i, j] of sides) {
      const vert = h === "e" || h === "w", W = (vert ? 7 : 22) * z, Hh = (vert ? 22 : 7) * z;
      s += `<rect data-h="${h}" x="${xs[i] - W / 2}" y="${ys[j] - Hh / 2}" width="${W}" height="${Hh}" rx="${3.5 * z}" fill="#fff" stroke="#c8c9d4" stroke-width="${z}" style="cursor:${cur[h]}-resize" filter="url(#dgShadow)"/>`;
    }
    for (const [h, i, j] of H) s += `<circle data-h="${h}" cx="${xs[i]}" cy="${ys[j]}" r="${7 * z}" fill="#fff" stroke="#c8c9d4" stroke-width="${z}" style="cursor:${cur[h]}-resize" filter="url(#dgShadow)"/>`;
    return s;
  }
  function connTarget() {                   // hình hiện 4 nút + : hình đang chọn duy nhất, hoặc hình dưới con trỏ
    if (editingId || (drag && drag.type !== "connect") || tool !== "select") return null;
    if (drag && drag.type === "connect") return get(drag.src);
    const L = selList(); const one = L.length === 1 ? L[0] : null;
    if (one && one.t === "s" && !one.lk) return one;
    const h = hover && get(hover); if (h && h.t === "s" && !h.lk && !L.length) return h;
    return null;
  }
  function connDots(t, z) {
    let s = "";
    for (const sd of ["t", "r", "b", "l"]) {
      const A = anchor(t, sd), off = 24 * z, cx = A.x + A.d.x * off, cy = A.y + A.d.y * off, r = 10 * z;
      const bx = Math.min(A.x, cx) - (A.d.x ? 0 : r), by = Math.min(A.y, cy) - (A.d.y ? 0 : r);
      s += `<rect data-bridge="${t.id}" x="${bx}" y="${by}" width="${A.d.x ? off : 2 * r}" height="${A.d.y ? off : 2 * r}" fill="transparent"/>`;
      s += `<g data-cn="${sd}" data-src="${t.id}" class="dg-cn"><circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" stroke="${SEL}" stroke-width="${1.6 * z}"/><path d="M${cx - 4.5 * z},${cy}h${9 * z}M${cx},${cy - 4.5 * z}v${9 * z}" stroke="${SEL}" stroke-width="${1.8 * z}" stroke-linecap="round"/></g>`;
    }
    return s;
  }

  /* ---------- thanh công cụ nổi (như Canva) ---------- */
  let ctxKey = "";
  function placeCtx() {
    const L = selList();
    if (!L.length || (drag && drag.moved) || (drag && drag.type === "pen")) { ctxBar.hidden = true; ctxKey = ""; return; }
    const key = L.map(i => i.id).join(",") + "|" + JSON.stringify(L.map(i => [i.fill, i.stroke, i.sw, i.dash, i.tc, i.fs, i.b, i.it, i.al, i.col, i.lw, i.rt, i.s, i.e, i.lk, i.shp]));
    if (key !== ctxKey) { ctxKey = key; buildCtx(L); }
    ctxBar.hidden = false;
    const b = union(L, map()); if (!b) return;
    const p0 = toScreen(b.x0, b.y0), p1 = toScreen(b.x1, b.y1), sw = stage.clientWidth, bw = ctxBar.offsetWidth, bh = ctxBar.offsetHeight;
    const gap = L.length === 1 && L[0].t === "s" ? 48 : 16;
    let y = p0.y - bh - gap; if (y < 8) y = p1.y + gap; if (y + bh > stage.clientHeight - 8) y = 8;
    const minL = sw > 760 ? 82 : 8;
    ctxBar.style.left = clamp((p0.x + p1.x) / 2 - bw / 2, minL, Math.max(minL, sw - bw - 8)) + "px"; ctxBar.style.top = y + "px";
  }
  function apply(fn) { for (const it of selList()) if (!it.lk) fn(it); render(); commit(); }
  function buildCtx(L) {
    const S = L.filter(i => i.t === "s"), N = L.filter(i => i.t === "l"), D = L.filter(i => i.t === "d"), locked = L.every(i => i.lk);
    const B = (a, html, title, cls = "") => `<button type="button" class="dg-cb ${cls}" data-c="${a}" title="${esc(title)}">${html}</button>`;
    let h = "";
    if (!locked) {
      if (S.length) {
        const f = S[0], solid = S.filter(i => i.shp !== "text");
        if (solid.length && solid.every(i => i.shp !== "sticky")) h += B("kind", shpIcon(solid[0].shp) + "▾", "Đổi kiểu hình");
        if (solid.length) {
          h += B("fill", `<i class="dg-sw" style="background:${solid[0].fill === "none" ? "transparent" : solid[0].fill}"></i>`, "Màu nền hình", solid[0].fill === "none" ? "none" : "");
          if (solid.every(i => i.shp !== "sticky")) h += B("stroke", `<i class="dg-bd" style="border-color:${solid[0].sw > 0 ? solid[0].stroke : "#bbb"};border-style:${solid[0].sw > 0 ? (solid[0].dash ? "dashed" : "solid") : "dotted"}"></i>`, "Viền: màu, độ dày, kiểu nét");
          h += '<span class="dg-csep"></span>';
        }
        h += B("fs-", "−", "Chữ nhỏ hơn") + `<input class="dg-fs" type="number" min="6" max="200" value="${Math.round(f.fs)}" title="Cỡ chữ">` + B("fs+", "+", "Chữ to hơn");
        h += B("tc", `<span class="dg-A" style="border-color:${f.tc}">A</span>`, "Màu chữ");
        h += B("b", "<b>B</b>", "Chữ đậm (Ctrl+B)", S.every(i => i.b) ? "on" : "") + B("i", "<i>I</i>", "Chữ nghiêng (Ctrl+I)", S.every(i => i.it) ? "on" : "");
        h += B("al", svgI(f.al === "l" ? "alL" : f.al === "r" ? "alR" : "alC"), "Căn chữ: trái / giữa / phải");
        h += '<span class="dg-csep"></span>';
      }
      if (N.length) {
        const f = N[0];
        h += B("lcol", `<i class="dg-sw ln" style="background:${f.col}"></i>`, "Màu đường");
        h += B("lsty", `<svg viewBox="0 0 30 20" class="shi"><path d="M3 10h24" stroke="currentColor" stroke-width="${clamp(f.lw, 1, 6)}"${f.dash ? ' stroke-dasharray="5 3"' : ""}/></svg>`, "Độ dày, kiểu nét");
        h += B("lrt", svgI(f.rt || "elbow"), "Kiểu đường: gấp khúc / thẳng / cong");
        h += B("ls", endIcon(f.s, true), "Đầu đường") + B("le", endIcon(f.e, false), "Cuối đường");
        if (N.length === 1) h += B("lbl", svgI("label") + "<span>Chữ</span>", "Thêm / sửa chữ trên đường (bấm đúp vào đường)");
        h += '<span class="dg-csep"></span>';
      }
      if (D.length) {
        h += B("dcol", `<i class="dg-sw ln" style="background:${D[0].col}"></i>`, "Màu nét vẽ") + B("dsty", `<svg viewBox="0 0 30 20" class="shi"><path d="M3 10h24" stroke="currentColor" stroke-width="${clamp(D[0].lw, 1, 8)}"/></svg>`, "Độ dày nét vẽ");
        h += '<span class="dg-csep"></span>';
      }
      h += B("dup", svgI("dup"), "Nhân bản (Ctrl+D)");
    }
    h += B("lock", svgI(locked ? "unlock" : "lock"), locked ? "Mở khoá" : "Khoá (không kéo / sửa nhầm)", locked ? "on" : "");
    if (!locked) h += B("more", svgI("more"), "Thêm: lớp, sao chép…") + B("del", svgI("trash"), "Xoá (Delete)");
    ctxBar.innerHTML = h;
    const fsIn = ctxBar.querySelector(".dg-fs");
    if (fsIn) {
      fsIn.onkeydown = e => { e.stopPropagation(); if (e.key === "Enter") fsIn.blur(); };
      fsIn.onchange = () => { const v = clamp(Number(fsIn.value) || 22, 6, 200); apply(it => { if (it.t === "s") it.fs = v; }); };
    }
  }
  ctxBar.addEventListener("pointerdown", e => e.stopPropagation());
  ctxBar.addEventListener("click", e => {
    const b = e.target.closest("[data-c]"); if (!b) return;
    const c = b.dataset.c, L = selList(), S = L.filter(i => i.t === "s");
    const at = () => { const r = b.getBoundingClientRect(), s = stage.getBoundingClientRect(); return {x: r.left - s.left, y: r.bottom - s.top + 6}; };
    if (c === "fs-" || c === "fs+") { const d = c === "fs+" ? 1 : -1; apply(it => { if (it.t === "s") it.fs = clamp(Math.round(it.fs + d * Math.max(1, it.fs * .1)), 6, 200); }); return; }
    if (c === "b") { const v = S.every(i => i.b) ? 0 : 1; apply(it => { if (it.t === "s") it.b = v; }); return; }
    if (c === "i") { const v = S.every(i => i.it) ? 0 : 1; apply(it => { if (it.t === "s") it.it = v; }); return; }
    if (c === "al") { const nx = {l: "c", c: "r", r: "l"}[S[0].al || "c"]; apply(it => { if (it.t === "s") it.al = nx; }); return; }
    if (c === "dup") return dupSel();
    if (c === "del") return delSel();
    if (c === "lock") return lockSel();
    if (c === "lbl") { const l = L.find(i => i.t === "l"); if (l) editLabel(l.id); return; }
    if (c === "lrt") return showPop(at(), "Kiểu đường", [["elbow", svgI("elbow"), "Gấp khúc"], ["straight", svgI("straight"), "Thẳng"], ["curve", svgI("curve"), "Cong"]].map(([v, ic, t]) => ({html: ic + `<span>${t}</span>`, on: L.find(i => i.t === "l").rt === v, fn: () => { lineStyle.rt = v; apply(it => { if (it.t === "l") it.rt = v; }); }})), "list");
    if (c === "ls" || c === "le") {
      const k = c === "ls" ? "s" : "e", names = ["Không", "Mũi tên", "Mũi tên nét", "Chấm tròn"];
      return showPop(at(), k === "s" ? "Đầu đường" : "Cuối đường", [0, 1, 2, 3].map(v => ({html: endIcon(v, k === "s") + `<span>${names[v]}</span>`, on: L.find(i => i.t === "l")[k] === v, fn: () => { lineStyle[k] = v; apply(it => { if (it.t === "l") it[k] = v; }); }})), "list");
    }
    if (c === "kind") return showPop(at(), "Kiểu hình", SHAPES.map(([k, t]) => ({html: shpIcon(k), title: t, on: S[0].shp === k, fn: () => apply(it => { if (it.t === "s" && it.shp !== "text" && it.shp !== "sticky") it.shp = k; })})), "grid");
    if (c === "fill") return colorPop(at(), "Màu nền", S.find(i => i.shp !== "text").fill, v => apply(it => { if (it.t === "s" && it.shp !== "text") it.fill = v; }), true);
    if (c === "tc") return colorPop(at(), "Màu chữ", S[0].tc, v => apply(it => { if (it.t === "s") it.tc = v; }));
    if (c === "lcol") return colorPop(at(), "Màu đường", L.find(i => i.t === "l").col, v => { lineStyle.col = v; apply(it => { if (it.t === "l") it.col = v; }); });
    if (c === "dcol") return colorPop(at(), "Màu nét vẽ", L.find(i => i.t === "d").col, v => { penStyle.col = v; apply(it => { if (it.t === "d") it.col = v; }); });
    if (c === "stroke") return strokePop(at(), S.find(i => i.shp !== "text"));
    if (c === "lsty") return widthPop(at(), "Đường", L.find(i => i.t === "l"), 1, 12, (it, v) => { if (it.t === "l") it.lw = v; }, (it, v) => { if (it.t === "l") it.dash = v; });
    if (c === "dsty") return widthPop(at(), "Nét vẽ", L.find(i => i.t === "d"), 1, 30, (it, v) => { if (it.t === "d") it.lw = v; });
    if (c === "more") return showPop(at(), "", [
      {html: "<span>Đưa lên trên cùng</span><kbd>Ctrl+Alt+]</kbd>", fn: () => layer("front")}, {html: "<span>Đưa lên một lớp</span><kbd>Ctrl+]</kbd>", fn: () => layer("up")},
      {html: "<span>Đưa xuống một lớp</span><kbd>Ctrl+[</kbd>", fn: () => layer("down")}, {html: "<span>Đưa xuống dưới cùng</span><kbd>Ctrl+Alt+[</kbd>", fn: () => layer("back")},
      {sep: 1}, {html: "<span>Sao chép</span><kbd>Ctrl+C</kbd>", fn: () => copySel()}, {html: "<span>Cắt</span><kbd>Ctrl+X</kbd>", fn: () => copySel(true)},
      {html: "<span>Phóng tới mục này</span>", fn: () => fitTo(selList())}], "list");
  });

  /* ---------- hộp chọn (màu, nét, hình…) ---------- */
  function closePop() { pop.hidden = true; pop.innerHTML = ""; q('[data-tool="shape"]').classList.remove("open"); }
  function showPop(at, title, opts2, mode) {
    pop.innerHTML = (title ? `<div class="dg-ph">${esc(title)}</div>` : "") + `<div class="dg-${mode}"></div>`;
    const box = pop.lastChild;
    for (const o of opts2) {
      if (o.sep) { box.insertAdjacentHTML("beforeend", "<hr>"); continue; }
      if (o.head) { box.insertAdjacentHTML("beforeend", `<div class="dg-ph">${esc(o.head)}</div>`); continue; }
      const b = document.createElement("button"); b.type = "button"; b.className = "dg-po" + (o.on ? " on" : ""); b.innerHTML = o.html; if (o.title) b.title = o.title;
      b.onclick = () => { if (!o.keep) closePop(); o.fn(); }; box.appendChild(b);
    }
    openPop(at);
  }
  function openPop(at) {
    pop.hidden = false;
    const sw = stage.clientWidth, sh = stage.clientHeight, w = pop.offsetWidth, h = pop.offsetHeight;
    pop.style.left = clamp(at.x, 8, Math.max(8, sw - w - 8)) + "px"; pop.style.top = clamp(at.y, 8, Math.max(8, sh - h - 8)) + "px";
  }
  function docColors() { const s = new Set(); for (const i of items) for (const k of ["fill", "stroke", "tc", "col"]) if (i[k] && i[k] !== "none" && /^#/.test(i[k])) s.add(i[k].toLowerCase()); return [...s].slice(0, 18); }
  function colorPop(at, title, curC, fn, allowNone) {
    const sw = c => `<button type="button" class="dg-c${(curC || "").toLowerCase() === c ? " on" : ""}" data-col="${c}" title="${c}" style="background:${c}"></button>`;
    pop.innerHTML = `<div class="dg-ph">${esc(title)}</div>` +
      (docColors().length ? `<div class="dg-sub">Màu trong sơ đồ</div><div class="dg-cols">${docColors().map(sw).join("")}</div>` : "") +
      `<div class="dg-sub">Bảng màu</div><div class="dg-cols">${allowNone ? `<button type="button" class="dg-c dg-none${curC === "none" ? " on" : ""}" data-col="none" title="Không màu"></button>` : ""}${PALETTE.map(sw).join("")}</div>
      <label class="dg-custom">Màu khác <input type="color" value="${/^#[0-9a-f]{6}$/i.test(curC || "") ? curC : "#1a5fbf"}"></label>`;
    pop.onclick = e => { const b = e.target.closest("[data-col]"); if (b) { fn(b.dataset.col); colorPop(at, title, b.dataset.col, fn, allowNone); } };
    pop.querySelector("input[type=color]").onchange = e => { fn(e.target.value); };
    openPop(at);
  }
  function strokePop(at, f) {
    pop.onclick = null;
    pop.innerHTML = `<div class="dg-ph">Viền hình</div><div class="dg-sub">Độ dày: <b class="dg-wv">${f.sw}</b></div><input type="range" class="dg-rng" min="0" max="12" step=".5" value="${f.sw}">
      <div class="dg-list"><button type="button" class="dg-po${!f.dash ? " on" : ""}" data-d="0"><svg viewBox="0 0 30 20" class="shi"><path d="M3 10h24" stroke="currentColor" stroke-width="2"/></svg><span>Nét liền</span></button>
      <button type="button" class="dg-po${f.dash ? " on" : ""}" data-d="1"><svg viewBox="0 0 30 20" class="shi"><path d="M3 10h24" stroke="currentColor" stroke-width="2" stroke-dasharray="5 3"/></svg><span>Nét đứt</span></button></div>
      <div class="dg-sub">Màu viền</div><div class="dg-cols">${[...new Set([...docColors(), ...PALETTE])].slice(0, 36).map(c => `<button type="button" class="dg-c${(f.stroke || "").toLowerCase() === c ? " on" : ""}" data-col="${c}" style="background:${c}" title="${c}"></button>`).join("")}</div>`;
    const rng = pop.querySelector(".dg-rng");
    rng.oninput = () => { pop.querySelector(".dg-wv").textContent = rng.value; for (const it of selList()) if (it.t === "s" && !it.lk) it.sw = Number(rng.value); render(); };
    rng.onchange = () => commit();
    pop.onclick = e => {
      const d = e.target.closest("[data-d]"), c = e.target.closest("[data-col]");
      if (d) { apply(it => { if (it.t === "s") { it.dash = +d.dataset.d; if (!it.sw) it.sw = 1.5; } }); strokePop(at, f); }
      if (c) { apply(it => { if (it.t === "s") { it.stroke = c.dataset.col; if (!it.sw) it.sw = 1.5; } }); strokePop(at, f); }
    };
    openPop(at);
  }
  function widthPop(at, title, f, min, max, setW, setDash) {
    pop.onclick = null;
    pop.innerHTML = `<div class="dg-ph">${esc(title)}</div><div class="dg-sub">Độ dày: <b class="dg-wv">${f.lw}</b></div><input type="range" class="dg-rng" min="${min}" max="${max}" step=".5" value="${f.lw}">` +
      (setDash ? `<div class="dg-list"><button type="button" class="dg-po${!f.dash ? " on" : ""}" data-d="0"><svg viewBox="0 0 30 20" class="shi"><path d="M3 10h24" stroke="currentColor" stroke-width="2"/></svg><span>Nét liền</span></button>
      <button type="button" class="dg-po${f.dash ? " on" : ""}" data-d="1"><svg viewBox="0 0 30 20" class="shi"><path d="M3 10h24" stroke="currentColor" stroke-width="2" stroke-dasharray="5 3"/></svg><span>Nét đứt</span></button></div>` : "");
    const rng = pop.querySelector(".dg-rng");
    rng.oninput = () => { pop.querySelector(".dg-wv").textContent = rng.value; for (const it of selList()) if (!it.lk) setW(it, Number(rng.value)); if (f.t === "l") lineStyle.lw = Number(rng.value); else penStyle.lw = Number(rng.value); render(); };
    rng.onchange = () => commit();
    pop.onclick = e => { const d = e.target.closest("[data-d]"); if (d && setDash) { lineStyle.dash = +d.dataset.d; apply(it => setDash(it, +d.dataset.d)); widthPop(at, title, f, min, max, setW, setDash); } };
    openPop(at);
  }

  /* ---------- công cụ bên trái ---------- */
  function setTool(t, arg) {
    if (editingId) finishEdit();
    tool = t; toolArg = arg || null; closePop();
    root.querySelectorAll("[data-tool]").forEach(b => b.classList.toggle("on", b.dataset.tool === t));
    stage.classList.toggle("dg-cross", t !== "select" && t !== "hand");
    stage.classList.toggle("dg-handc", t === "hand");
    const msg = {shape: "Bấm vào trang để thêm hình, hoặc kéo để vẽ đúng cỡ · Esc để huỷ", line: "Kéo từ hình này sang hình kia để nối (hoặc vẽ đường tự do) · Esc để huỷ",
      text: "Bấm vào trang để gõ chữ · Esc để huỷ", sticky: "Bấm vào trang để dán giấy note · Esc để huỷ", pen: "Kéo để vẽ tay · Esc để thôi vẽ", hand: "Kéo để di chuyển trang"}[t];
    hint.hidden = !msg; hint.textContent = msg || "";
    if (t !== "select") { sel.clear(); hover = null; }
    render();
  }
  q(".dg-tools").addEventListener("click", e => {
    const b = e.target.closest("[data-tool]"); if (!b) return;
    const t = b.dataset.tool, r = b.getBoundingClientRect(), s = stage.getBoundingClientRect(), at = {x: r.right - s.left + 10, y: r.top - s.top - 8};
    if (t === "tpl") {
      showPop(at, "Sơ đồ mẫu", [
        {html: `<svg class="tpi" viewBox="0 0 48 32"><ellipse cx="24" cy="5" rx="8" ry="4"/><rect x="2" y="15" width="12" height="5" rx="2.5"/><rect x="18" y="15" width="12" height="5" rx="2.5"/><rect x="34" y="15" width="12" height="5" rx="2.5"/><rect x="14" y="26" width="9" height="5"/><rect x="25" y="26" width="9" height="5"/><path d="M24 9v6M8 15v-3h32v3M24 20v6"/></svg><span>Ý chính → 3 nhánh</span>`, fn: () => addTemplate()},
        {html: `<svg class="tpi" viewBox="0 0 48 32"><rect x="2" y="3" width="15" height="10"/><rect x="31" y="3" width="15" height="10"/><rect x="17" y="13" width="14" height="6"/><rect x="2" y="19" width="15" height="10"/><rect x="31" y="19" width="15" height="10"/></svg><span>4 góc + ô trung tâm</span>`, fn: () => addTemplate("4")}], "list");
      return;
    }
    if (t === "shape") {
      setTool("select"); b.classList.add("open");
      showPop(at, "Hình", [...SHAPES.map(([k, tt]) => ({html: shpIcon(k), title: tt + " — bấm rồi bấm / kéo trên trang", fn: () => setTool("shape", k)}))], "grid");
      pop.insertAdjacentHTML("beforeend", '<p class="dg-tip">Mẹo: chọn một hình rồi bấm nút <b>+</b> ở cạnh để thêm hình nối, kéo nút <b>+</b> sang hình khác để vẽ đường nối.</p>');
      b.classList.add("open"); return;
    }
    if (t === "sticky") { setTool("sticky"); showPop(at, "Màu giấy note", STICKY.map(c => ({html: `<i class="dg-sw big" style="background:${c}"></i>`, on: c === stickyCol, keep: 1, fn: () => { stickyCol = c; showPop(at, "Màu giấy note", [], "grid"); closePop(); }})), "grid"); return; }
    if (t === "pen") { setTool("pen"); return; }
    setTool(t);
  });

  /* ---------- thêm, sửa, xoá ---------- */
  const newShape = (shp, x, y, w, h, extra) => {
    const it = {id: uid(), t: "s", shp, txt: "", x, y, w, h, ...DEF_SHAPE, ...extra};
    if (shp === "text") Object.assign(it, {fill: "none", stroke: "none", sw: 0, tc: "#1f2a44", fs: 28, al: "l", aw: 1});
    if (shp === "sticky") Object.assign(it, {fill: stickyCol, stroke: "none", sw: 0, tc: "#1f2a44", fs: 20, al: "c"});
    return it;
  };
  const center = () => ({x: (stage.clientWidth / 2 - view.x) / view.z, y: (stage.clientHeight / 2 - view.y) / view.z});
  function addTemplate(kind) {
    setTool("select");
    const c = center(), t = kind === "4" ? template4() : template("Ý TƯỞNG CHÍNH"), b = union(t, idMap(t)), dx = c.x - (b.x0 + b.x1) / 2, dy = c.y - (b.y0 + b.y1) / 2;
    for (const it of t) if (it.t === "s") { it.x += dx; it.y += dy; }
    items.push(...t); sel = new Set(t.filter(i => i.t === "s").map(i => i.id)); render(); commit(); fitTo(t);
  }
  function lineFrom(a, b) { return {id: uid(), t: "l", ...lineStyle, lbl: "", a, b}; }
  function styleOfLinesFrom(id) { const l = [...items].reverse().find(i => i.t === "l" && ((i.a && i.a.id === id) || (i.b && i.b.id === id))); return l ? {rt: l.rt, col: l.col, lw: l.lw, dash: l.dash, s: l.s, e: l.e, lfs: l.lfs} : {}; }
  const overlap = (a, b, m) => a.x0 - m < b.x1 && a.x1 + m > b.x0 && a.y0 - m < b.y1 && a.y1 + m > b.y0;
  /* bấm nút + cạnh hình (như Canva): thêm hình giống hệt theo hướng đó và tự nối; chỗ đó có hình rồi thì dịch sang bên */
  function quickAdd(id, sd) {
    const src = get(id); if (!src) return;
    const v = DIRV[sd], nw = {...clone(src), id: uid(), txt: "", lk: 0};
    if (nw.shp === "text") { nw.w = Math.max(nw.w, 160); }
    const gap = v.y ? 110 : 90, M = map();
    const bx = src.x + src.w / 2 + v.x * (src.w / 2 + gap + nw.w / 2), by = src.y + src.h / 2 + v.y * (src.h / 2 + gap + nw.h / 2), step = v.x ? nw.h + 40 : nw.w + 40;
    for (let k = 0; k < 15; k++) {
      const o = k === 0 ? 0 : (k % 2 ? 1 : -1) * Math.ceil(k / 2) * step;
      nw.x = bx + (v.x ? 0 : o) - nw.w / 2; nw.y = by + (v.x ? o : 0) - nw.h / 2;
      const nb = bbox(nw); if (!items.some(i => i.t === "s" && overlap(bbox(i, M), nb, 8))) break;
    }
    const l = {...lineFrom({id: src.id, sd}, {id: nw.id, sd: OPP[sd]}), ...styleOfLinesFrom(src.id)};
    items.push(l, nw); sel = new Set([nw.id]); hover = null; render(); commit();
    if (!isVisible(nw)) panTo(nw);
  }
  function isVisible(it) { const p0 = toScreen(it.x, it.y), p1 = toScreen(it.x + it.w, it.y + it.h); return p0.x > 0 && p0.y > 0 && p1.x < stage.clientWidth && p1.y < stage.clientHeight; }
  function panTo(it) { view.x = stage.clientWidth / 2 - (it.x + it.w / 2) * view.z; view.y = stage.clientHeight / 2 - (it.y + it.h / 2) * view.z; applyView(); renderUI(); placeCtx(); }
  function shapeAt(w, excl) {
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i]; if (it.t !== "s" || it.id === excl) continue;
      const m = 10 / view.z; if (w.x >= it.x - m && w.x <= it.x + it.w + m && w.y >= it.y - m && w.y <= it.y + it.h + m) return it;
    }
    return null;
  }
  function endAt(w, excl) { const t = shapeAt(w, excl); return t ? {id: t.id, sd: nearestSide(t, w.x, w.y)} : {x: w.x, y: w.y}; }
  function delSel() {
    if (editingId) return;
    const ids = new Set(selList().filter(i => !i.lk).map(i => i.id)); if (!ids.size) return;
    items = items.filter(i => !ids.has(i.id) && !(i.t === "l" && ((i.a.id && ids.has(i.a.id)) || (i.b.id && ids.has(i.b.id)))));
    sel.clear(); hover = null; closePop(); render(); commit();
  }
  function lockSel() { const v = selList().every(i => i.lk) ? 0 : 1; for (const it of selList()) it.lk = v; ctxKey = ""; closePop(); render(); commit(); }
  function layer(how) {
    const S = selList(); if (!S.length) return; const rest = items.filter(i => !sel.has(i.id));
    if (how === "front") items = [...rest, ...S];
    else if (how === "back") items = [...S, ...rest];
    else {
      const arr = items.slice(), idx = arr.map((it, i) => sel.has(it.id) ? i : -1).filter(i => i >= 0);
      if (how === "up") for (let k = idx.length - 1; k >= 0; k--) { const i = idx[k]; if (i < arr.length - 1 && !sel.has(arr[i + 1].id)) [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]; }
      else for (const i of idx) if (i > 0 && !sel.has(arr[i - 1].id)) [arr[i], arr[i - 1]] = [arr[i - 1], arr[i]];
      items = arr;
    }
    render(); commit();
  }
  /* nhân bản / dán: mã mới, đường nối trỏ sang mục mới; đầu nối trỏ ra ngoài nhóm thì thành đầu tự do */
  function cloneSet(list, dx, dy, M) {
    const ids = new Map(list.filter(i => i.t !== "l").map(i => [i.id, uid()])), out = [];
    for (const it of list) {
      const c = clone(it); c.lk = 0;
      if (c.t === "l") {
        let ok = true;
        for (const e of ["a", "b"]) {
          const en = c[e];
          if (en.id) { if (ids.has(en.id)) en.id = ids.get(en.id); else { const p = M && endPt(it[e], M); if (!p) { ok = false; break; } c[e] = {x: p.x + dx, y: p.y + dy}; } }
          else { en.x += dx; en.y += dy; }
        }
        if (!ok) continue; c.id = uid();
      } else if (c.t === "d") { c.id = ids.get(it.id); c.pts = c.pts.map(p => [p[0] + dx, p[1] + dy]); }
      else { c.id = ids.get(it.id); c.x += dx; c.y += dy; }
      out.push(c);
    }
    return out;
  }
  function dupSel() {
    const L = selList(); if (!L.length) return;
    const add = cloneSet(withLinks(L), 30, 30, map()); items.push(...add); sel = new Set(add.map(i => i.id)); closePop(); render(); commit();
  }
  function withLinks(L) {                     // chép hình thì chép luôn đường nối giữa các hình đang chọn
    const ids = new Set(L.map(i => i.id));
    return items.filter(i => ids.has(i.id) || (i.t === "l" && i.a.id && i.b.id && ids.has(i.a.id) && ids.has(i.b.id)));
  }
  const CLIP = "VMDIAGRAM:";
  function copySel(cut) {
    const L = selList(); if (!L.length) return;
    const data = JSON.stringify(withLinks(L).map(i => { const c = clone(i); if (c.t === "l") for (const e of ["a", "b"]) if (c[e].id && !L.some(x => x.id === c[e].id)) { const p = endPt(i[e], map()); c[e] = p ? {x: p.x, y: p.y} : c[e]; } return c; }));
    try { localStorage.setItem("vm.dgclip", data); } catch {}
    try { navigator.clipboard && navigator.clipboard.writeText(CLIP + data).catch(() => {}); } catch {}
    if (cut) delSel();
  }
  function pasteItems(list) {
    list = normalize(list); if (!list.length) return;
    const b = union(list, idMap(list)), c = center(), dx = c.x - (b.x0 + b.x1) / 2 + 20, dy = c.y - (b.y0 + b.y1) / 2 + 20;
    const add = cloneSet(list, dx, dy, idMap(list)); items.push(...add); sel = new Set(add.map(i => i.id)); setTool("select"); render(); commit();
  }
  function selectAll() { sel = new Set(items.map(i => i.id)); render(); }

  /* ---------- gõ chữ trong hình (như Canva: bấm đúp, hoặc gõ phím khi đang chọn hình) ---------- */
  function startEdit(id, initial, pt) {
    const it = get(id); if (!it || it.t !== "s" || it.lk) return;
    closePop(); closeMenu();
    editingId = id; sel = new Set([id]); hover = null;
    ed.textContent = initial != null ? initial : it.txt; if (initial != null) { it.txt = initial; }
    edWrap.hidden = false; render();
    ed.focus({preventScroll: true});
    const r = document.createRange(), s = getSelection();
    let placed = false;
    if (pt && initial == null && document.caretRangeFromPoint) { const cr = document.caretRangeFromPoint(pt.x, pt.y); if (cr && ed.contains(cr.startContainer)) { s.removeAllRanges(); s.addRange(cr); placed = true; } }
    if (!placed) { r.selectNodeContents(ed); if (initial != null) r.collapse(false); s.removeAllRanges(); s.addRange(r); }
  }
  function readEd() { let t = ed.innerText.replace(/ /g, " "); if (t.endsWith("\n") && !ed.textContent.endsWith("\n")) t = t.slice(0, -1); return t; }
  function placeEdit() {
    const it = get(editingId); if (!it) return;
    const I = inset(it), z = view.z, p = toScreen(it.x + I.l, it.y + I.t);
    Object.assign(edWrap.style, {left: p.x + "px", top: p.y + "px", width: Math.max(8, (it.w - I.l - I.r) * z) + "px", height: Math.max(8, (it.h - I.t - I.b) * z) + "px",
      alignItems: "center"});
    Object.assign(ed.style, {fontSize: it.fs * z + "px", lineHeight: LH, fontWeight: it.b ? 700 : 400, fontStyle: it.it ? "italic" : "normal", color: it.tc, textAlign: {l: "left", r: "right"}[it.al] || "center",
      minWidth: it.shp === "text" ? "1px" : "100%", whiteSpace: it.shp === "text" && it.aw ? "pre" : "pre-wrap"});
  }
  ed.addEventListener("input", () => { const it = get(editingId); if (!it) return; it.txt = readEd(); render(); });
  ed.addEventListener("keydown", e => {
    e.stopPropagation();
    if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) { e.preventDefault(); finishEdit(); stage.focus({preventScroll: true}); }
    if ((e.ctrlKey || e.metaKey) && (e.key === "b" || e.key === "i")) { e.preventDefault(); const it = get(editingId); if (it) { if (e.key === "b") it.b = it.b ? 0 : 1; else it.it = it.it ? 0 : 1; ctxKey = ""; render(); } }
  });
  ed.addEventListener("blur", () => setTimeout(() => { if (editingId && document.activeElement !== ed && !ctxBar.contains(document.activeElement) && !pop.contains(document.activeElement)) finishEdit(); }, 0));
  function finishEdit() {
    const it = get(editingId); if (!it) { editingId = null; edWrap.hidden = true; return; }
    it.txt = readEd().replace(/\s+$/, ""); editingId = null; edWrap.hidden = true;
    if (it.shp === "text" && !it.txt.trim()) { items = items.filter(i => i !== it && !(i.t === "l" && (i.a.id === it.id || i.b.id === it.id))); sel.delete(it.id); }
    render(); commit();
  }
  function editLabel(id) {
    const l = get(id); if (!l || l.t !== "l" || l.lk) return;
    const R = route(l, map()); if (!R) return;
    sel = new Set([id]); render();
    const p = toScreen(R.mid.x, R.mid.y);
    lblIn.value = l.lbl || ""; lblIn.hidden = false;
    lblIn.style.left = clamp(p.x - 120, 4, stage.clientWidth - 244) + "px"; lblIn.style.top = clamp(p.y - 18, 4, stage.clientHeight - 40) + "px";
    lblIn.focus(); setTimeout(() => { lblIn.focus(); lblIn.select(); }, 0);
    let fin = false;
    const done = ok => {
      if (fin) return; fin = true; lblIn.onkeydown = lblIn.onblur = null; lblIn.hidden = true;
      if (ok && get(id)) { l.lbl = lblIn.value.trim(); render(); commit(); }
      stage.focus({preventScroll: true});
    };
    lblIn.onkeydown = e => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); done(true); } else if (e.key === "Escape") done(false); };
    lblIn.onblur = () => done(true);
  }

  /* ---------- chuột / cảm ứng ---------- */
  function snapMove(L, dx, dy) {               // đường căn tím như Canva: mép / giữa thẳng hàng với hình khác
    guides = []; const M = map(), b0 = union(L.filter(i => i.t !== "l"), M); if (!b0) return [dx, dy];
    const ids = new Set(L.map(i => i.id)), others = items.filter(i => i.t === "s" && !ids.has(i.id)).map(i => bbox(i, M));
    const T = 6 / view.z, b = {x0: b0.x0 + dx, x1: b0.x1 + dx, y0: b0.y0 + dy, y1: b0.y1 + dy};
    const xsM = [b.x0, (b.x0 + b.x1) / 2, b.x1], ysM = [b.y0, (b.y0 + b.y1) / 2, b.y1];
    let bx = null, by = null;
    for (const o of others) {
      for (const xv of [o.x0, (o.x0 + o.x1) / 2, o.x1]) for (const m of xsM) { const d = xv - m; if (Math.abs(d) < T && (!bx || Math.abs(d) < Math.abs(bx.d))) bx = {d, x: xv, o}; }
      for (const yv of [o.y0, (o.y0 + o.y1) / 2, o.y1]) for (const m of ysM) { const d = yv - m; if (Math.abs(d) < T && (!by || Math.abs(d) < Math.abs(by.d))) by = {d, y: yv, o}; }
    }
    if (bx) dx += bx.d; if (by) dy += by.d;
    const nb = {x0: b0.x0 + dx, x1: b0.x1 + dx, y0: b0.y0 + dy, y1: b0.y1 + dy};
    if (bx) guides.push([bx.x, Math.min(nb.y0, bx.o.y0) - 20, bx.x, Math.max(nb.y1, bx.o.y1) + 20]);
    if (by) guides.push([Math.min(nb.x0, by.o.x0) - 20, by.y, Math.max(nb.x1, by.o.x1) + 20, by.y]);
    return [dx, dy];
  }
  function itemUnder(e) {
    const t = e.target;
    if (t.closest && t.closest("[data-bridge]")) {                     // dải nối tới nút +: nhìn xuyên xuống
      for (const el of document.elementsFromPoint(e.clientX, e.clientY)) { const g = el.closest && el.closest(".dg-items [data-id]"); if (g) return g.dataset.id; }
      return null;
    }
    const g = t.closest && t.closest(".dg-items [data-id]"); return g ? g.dataset.id : null;
  }
  svg.addEventListener("pointerdown", e => {
    if (e.button === 2) return;
    closePop(); closeMenu();
    if (editingId) finishEdit();
    if (!lblIn.hidden) lblIn.blur();
    stage.focus({preventScroll: true});
    const sp = {x: e.clientX, y: e.clientY};
    pointers.set(e.pointerId, sp);
    if (pointers.size === 2) {                                           // hai ngón: thu phóng + kéo trang
      if (drag && drag.type === "move" && drag.moved) restoreOrig();
      const [p1, p2] = [...pointers.values()];
      drag = {type: "pinch", d0: Math.hypot(p1.x - p2.x, p1.y - p2.y), z0: view.z, c0: {x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2}, v0: {...view}};
      return;
    }
    if (e.pointerType !== "mouse" && tool === "select") {               // chạm đúp (điện thoại / iPad) = bấm đúp
      const id0 = itemUnder(e), now = Date.now();
      if (id0 && lastTap && lastTap.id === id0 && now - lastTap.t < 380 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
        lastTap = null; const it0 = get(id0);
        if (it0 && it0.t === "s") { e.preventDefault(); startEdit(id0); return; }
        if (it0 && it0.t === "l") { e.preventDefault(); editLabel(id0); return; }
      }
      lastTap = {id: id0, t: now, x: e.clientX, y: e.clientY};
    }
    svg.setPointerCapture(e.pointerId);
    const w = toWorld(e), t = e.target;
    if (e.button === 1 || space || tool === "hand") { drag = {type: "pan", sx: e.clientX, sy: e.clientY, v0: {...view}}; stage.classList.add("dg-panning"); return; }
    const h = t.closest && t.closest("[data-h]");
    if (h) { const it = selList()[0]; drag = {type: "resize", h: h.dataset.h, id: it.id, o: clone(it), w0: w, b0: bbox(it, map())}; return; }
    const cn = t.closest && t.closest("[data-cn]");
    if (cn) { drag = {type: "connect", src: cn.dataset.src, sd: cn.dataset.cn, w0: w, sx: e.clientX, sy: e.clientY}; sel = new Set([cn.dataset.src]); return; }
    const end = t.closest && t.closest("[data-end]");
    if (end) { drag = {type: "lend", id: selList()[0].id, end: end.dataset.end}; return; }
    if (tool === "shape" || tool === "text" || tool === "sticky") { drag = {type: "create", w0: w, sx: e.clientX, sy: e.clientY}; return; }
    if (tool === "line") { drag = {type: "newline", a: endAt(w), w0: w, sx: e.clientX, sy: e.clientY}; return; }
    if (tool === "pen") { drag = {type: "pen", pts: [[w.x, w.y]]}; return; }
    const id = itemUnder(e);
    if (id) {
      if (e.shiftKey || e.ctrlKey || e.metaKey) { if (sel.has(id)) sel.delete(id); else sel.add(id); render(); drag = null; return; }
      const wasSel = sel.size === 1 && sel.has(id);                     // bấm lần nữa vào giữa hình đang chọn = gõ chữ (như Canva)
      if (!sel.has(id)) sel = new Set([id]);
      const L = selList().filter(i => !i.lk);
      drag = {type: "move", w0: w, sx: e.clientX, sy: e.clientY, alt: e.altKey, ids: L.map(i => i.id), orig: new Map(L.map(i => [i.id, clone(i)])), wasSel, hit: id};
      render(); return;
    }
    if (!e.shiftKey) sel.clear();
    drag = {type: "marquee", w0: w, base: new Set(sel)}; render();
  });
  function restoreOrig() { if (!drag || !drag.orig) return; for (const [id, o] of drag.orig) { const i = items.findIndex(x => x.id === id); if (i >= 0) items[i] = clone(o); } }
  svg.addEventListener("pointermove", e => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (!drag) {
      const id0 = tool === "select" ? itemUnder(e) : null;
      svg.style.cursor = id0 && sel.size === 1 && sel.has(id0) && !editingId && inText(get(id0), toWorld(e)) ? "text" : "";
      const id = id0, it = id && get(id), nh = it && it.t !== "l" ? id : (e.target.closest && e.target.closest("[data-cn],[data-bridge]") ? hover : null);
      if (nh !== hover) { hover = nh; renderUI(); }
      return;
    }
    const w = toWorld(e), d = drag;
    const far = () => Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 4;
    if (d.type === "pinch") {
      const [p1, p2] = [...pointers.values()]; if (!p2) return;
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y), c = {x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2}, r = svg.getBoundingClientRect();
      const z = clamp(d.z0 * dist / (d.d0 || 1), .1, 4), wx = (d.c0.x - r.left - d.v0.x) / d.v0.z, wy = (d.c0.y - r.top - d.v0.y) / d.v0.z;
      view = {z, x: c.x - r.left - wx * z, y: c.y - r.top - wy * z}; applyView(); renderUI(); placeCtx(); return;
    }
    if (d.type === "pan") { view.x = d.v0.x + e.clientX - d.sx; view.y = d.v0.y + e.clientY - d.sy; applyView(); placeCtx(); return; }
    if (d.type === "move") {
      if (!d.moved) { if (!far()) return; d.moved = true;
        if (d.alt) {                                                     // Alt + kéo = nhân bản (như Canva)
          const L = d.ids.map(get).filter(Boolean), add = cloneSet(withLinks(L), 0, 0, map()); items.push(...add);
          d.ids = add.map(i => i.id); d.orig = new Map(add.map(i => [i.id, clone(i)])); sel = new Set(d.ids);
        }
      }
      let dx = w.x - d.w0.x, dy = w.y - d.w0.y; const L = d.ids.map(get).filter(Boolean);
      if (!e.altKey || d.alt) [dx, dy] = snapMove(L, dx, dy);
      for (const it of L) {
        const o = d.orig.get(it.id);
        if (it.t === "s") { it.x = o.x + dx; it.y = o.y + dy; }
        else if (it.t === "d") it.pts = o.pts.map(p => [p[0] + dx, p[1] + dy]);
        else for (const k of ["a", "b"]) if (o[k].x != null) it[k] = {x: o[k].x + dx, y: o[k].y + dy};
      }
      render(); return;
    }
    if (d.type === "resize") { resizeTo(d, w, e.shiftKey); render(); return; }
    if (d.type === "connect") {
      if (!d.moved) { if (!far()) return; d.moved = true; }
      const src = get(d.src), t = shapeAt(w, d.src), A = anchor(src, d.sd);
      d.hot = t ? t.id : null; d.end = t ? {id: t.id, sd: nearestSide(t, w.x, w.y)} : {x: w.x, y: w.y};
      const tmp = {...lineStyle, ...styleOfLinesFrom(src.id), a: {id: src.id, sd: d.sd}, b: d.end, lbl: ""}, R = route(tmp, map());
      d.temp = R ? `<path d="${linePath(tmp, R)}" fill="none" stroke="${SEL}" stroke-width="${2 / view.z}" stroke-dasharray="${6 / view.z} ${4 / view.z}" pointer-events="none"/>` : "";
      void A; renderUI(); return;
    }
    if (d.type === "lend") {
      const l = get(d.id), other = l[d.end === "a" ? "b" : "a"], t = shapeAt(w, other.id);
      l[d.end] = t ? {id: t.id, sd: nearestSide(t, w.x, w.y)} : {x: w.x, y: w.y}; d.hot = t ? t.id : null; d.moved = true; render(); return;
    }
    if (d.type === "create") {
      if (!far()) { d.box = null; d.temp = ""; renderUI(); return; }
      d.box = {x0: Math.min(d.w0.x, w.x), y0: Math.min(d.w0.y, w.y), x1: Math.max(d.w0.x, w.x), y1: Math.max(d.w0.y, w.y)};
      if (e.shiftKey) { const s = Math.max(d.box.x1 - d.box.x0, d.box.y1 - d.box.y0); d.box.x1 = d.box.x0 + s; d.box.y1 = d.box.y0 + s; }
      const k = tool === "shape" ? toolArg : tool === "sticky" ? "sticky" : "rect";
      d.temp = `<path transform="translate(${d.box.x0},${d.box.y0})" d="${outline(k, d.box.x1 - d.box.x0, d.box.y1 - d.box.y0)}" fill="${SEL}" fill-opacity=".08" stroke="${SEL}" stroke-width="${1.5 / view.z}" pointer-events="none"/>`;
      renderUI(); return;
    }
    if (d.type === "newline") {
      d.moved = d.moved || far(); const t = shapeAt(w, d.a.id); d.hot = t ? t.id : null; d.b = endAt(w, d.a.id);
      const tmp = {...lineStyle, a: d.a, b: d.b, lbl: ""}, R = route(tmp, map());
      d.temp = R ? `<path d="${linePath(tmp, R)}" fill="none" stroke="${SEL}" stroke-width="${2 / view.z}" pointer-events="none"/>` : ""; renderUI(); return;
    }
    if (d.type === "pen") {
      const p = d.pts[d.pts.length - 1]; if (Math.hypot(w.x - p[0], w.y - p[1]) < 2 / view.z) return;
      d.pts.push([w.x, w.y]);
      d.temp = `<path d="${penPath(d.pts)}" fill="none" stroke="${penStyle.col}" stroke-width="${penStyle.lw}" stroke-linecap="round" stroke-linejoin="round" pointer-events="none"/>`; renderUI(); return;
    }
    if (d.type === "marquee") {
      d.box = {x0: Math.min(d.w0.x, w.x), y0: Math.min(d.w0.y, w.y), x1: Math.max(d.w0.x, w.x), y1: Math.max(d.w0.y, w.y)};
      const M = map(); sel = new Set(d.base);
      for (const it of items) { const b = bbox(it, M); if (b && overlap(b, d.box, 0)) sel.add(it.id); }
      renderUI(); placeCtx();
    }
  });
  function resizeTo(d, w, keep) {
    const it = get(d.id), o = d.o, b = d.b0, h = d.h, MIN = 16;
    let x0 = b.x0, y0 = b.y0, x1 = b.x1, y1 = b.y1;
    if (h.includes("w")) x0 = Math.min(w.x, x1 - MIN); if (h.includes("e")) x1 = Math.max(w.x, x0 + MIN);
    if (h.includes("n")) y0 = Math.min(w.y, y1 - MIN); if (h.includes("s")) y1 = Math.max(w.y, y0 + MIN);
    const corner = h.length === 2, isText = it.t === "s" && it.shp === "text";
    if (corner && (keep || isText || it.t === "d")) {                     // góc: giữ tỉ lệ (chữ thì phóng cả cỡ chữ, như Canva)
      const k = Math.max((x1 - x0) / (b.x1 - b.x0), (y1 - y0) / (b.y1 - b.y0));
      const W = (b.x1 - b.x0) * k, H = (b.y1 - b.y0) * k;
      if (h.includes("w")) x0 = x1 - W; else x1 = x0 + W; if (h.includes("n")) y0 = y1 - H; else y1 = y0 + H;
    }
    if (it.t === "d") {
      const sx = (x1 - x0) / (b.x1 - b.x0 || 1), sy = (y1 - y0) / (b.y1 - b.y0 || 1);
      it.pts = o.pts.map(p => [x0 + (p[0] - b.x0) * sx, y0 + (p[1] - b.y0) * sy]); return;
    }
    if (isText) {
      if (corner) { const k = (x1 - x0) / (b.x1 - b.x0); it.fs = clamp(o.fs * k, 4, 400); it.w = o.w * k; it.x = h.includes("w") ? x1 - it.w : x0; it.y = h.includes("n") ? y1 - o.h * k : y0; }
      else { it.aw = 0; it.x = x0; it.w = x1 - x0; }
      return;
    }
    it.x = x0; it.y = y0; it.w = x1 - x0; it.h = y1 - y0;
  }
  function endDrag(e) {
    pointers.delete(e.pointerId);
    const d = drag; if (!d) return;
    if (d.type === "pinch") { if (pointers.size < 2) drag = null; return; }
    drag = null; guides = []; stage.classList.remove("dg-panning");
    const w = toWorld(e);
    if (d.type === "move") {
      if (d.moved) commit();
      else if (d.wasSel && e.type === "pointerup" && !e.shiftKey && inText(get(d.hit), w)) { startEdit(d.hit, null, {x: e.clientX, y: e.clientY}); return; }
      else if (!d.alt && d.ids.length > 1 && !e.shiftKey) { const id = itemUnder(e); if (id) sel = new Set([id]); }
    } else if (d.type === "resize" || d.type === "lend") commit();
    else if (d.type === "connect") {
      if (!d.moved) quickAdd(d.src, d.sd);
      else if (d.hot) { items.push({...lineFrom({id: d.src, sd: d.sd}, d.end), ...styleOfLinesFrom(d.src)}); sel = new Set([d.src]); commit(); }
      else {                                                              // thả ra chỗ trống: chọn hình để thêm ở đó (như Canva)
        const l = {...lineFrom({id: d.src, sd: d.sd}, {x: w.x, y: w.y}), ...styleOfLinesFrom(d.src)}; items.push(l); sel = new Set([l.id]); render(); commit();
        const r = svg.getBoundingClientRect(), s = stage.getBoundingClientRect();
        showPop({x: e.clientX - s.left + 12, y: e.clientY - s.top + 12}, "Thêm hình ở đầu đường", [...SHAPES.map(([k, t]) => ({html: shpIcon(k), title: t, fn: () => attachNew(l.id, k, w)}))], "grid");
        void r;
      }
    } else if (d.type === "create") {
      const k = tool === "shape" ? toolArg || "round" : tool === "sticky" ? "sticky" : "text";
      let it;
      if (tool === "text") { it = newShape("text", w.x, w.y - 18, 60, 36); if (d.box) { it.x = d.box.x0; it.y = d.box.y0; it.w = Math.max(40, d.box.x1 - d.box.x0); it.aw = 0; } }
      else if (d.box && d.box.x1 - d.box.x0 > 8) it = newShape(k, d.box.x0, d.box.y0, d.box.x1 - d.box.x0, Math.max(16, d.box.y1 - d.box.y0));
      else { const [W, H] = SIZE[k] || SIZE.round; it = newShape(k, d.w0.x - W / 2, d.w0.y - H / 2, W, H); }
      items.push(it); setTool("select"); sel = new Set([it.id]); render(); commit();
      if (it.shp === "text" || it.shp === "sticky") startEdit(it.id, "");
    } else if (d.type === "newline") {
      let a = d.a, b = d.b || endAt(w, a.id);
      if (!d.moved) { a = {x: d.w0.x - 120, y: d.w0.y}; b = {x: d.w0.x + 120, y: d.w0.y}; }
      const l = lineFrom(a, b); if (!a.id && !b.id && l.rt === "elbow" && d.moved) l.rt = "straight";
      items.push(l); setTool("select"); sel = new Set([l.id]); render(); commit();
    } else if (d.type === "pen") {
      if (d.pts.length > 1 || true) { items.push({id: uid(), t: "d", pts: d.pts, ...penStyle}); render(); commit(); }
    } else if (d.type === "marquee") render();
    render();
  }
  svg.addEventListener("pointerup", endDrag);
  svg.addEventListener("pointercancel", e => { pointers.delete(e.pointerId); if (drag && drag.type === "move" && drag.moved) restoreOrig(); drag = null; guides = []; render(); });
  svg.addEventListener("pointerleave", () => { if (!drag && hover) { hover = null; renderUI(); } });
  function attachNew(lid, k, w) {
    const l = get(lid); if (!l) return;
    const A = endPt(l.a, map()), v = axis({x: w.x - A.x, y: w.y - A.y}), sd = v.x > 0 ? "l" : v.x < 0 ? "r" : v.y > 0 ? "t" : "b";
    const src = l.a.id && get(l.a.id), [W, H] = src && src.shp !== "text" && src.shp !== "sticky" ? [src.w, src.h] : SIZE[k];
    const st = src && src.t === "s" && src.shp !== "text" ? {fill: src.fill, stroke: src.stroke, sw: src.sw, tc: src.tc, fs: src.fs, b: src.b} : {};
    const it = newShape(k, 0, 0, W, H, st), D = DIRV[OPP[sd]];
    it.x = w.x + D.x * W / 2 - W / 2 + (D.x ? 0 : 0); it.y = w.y + D.y * H / 2 - H / 2;
    if (!D.x) it.x = w.x - W / 2; if (!D.y) it.y = w.y - H / 2;
    items.push(it); l.b = {id: it.id, sd}; sel = new Set([it.id]); render(); commit();
  }
  svg.addEventListener("dblclick", e => {
    if (tool !== "select") return;
    const id = itemUnder(e), it = id && get(id); if (!it) return;
    if (it.t === "s") startEdit(id, null, {x: e.clientX, y: e.clientY});
    else if (it.t === "l") editLabel(id);
  });
  svg.addEventListener("contextmenu", e => {
    e.preventDefault(); closePop();
    const id = itemUnder(e); if (id && !sel.has(id)) { sel = new Set([id]); render(); }
    const s = stage.getBoundingClientRect(), w = toWorld(e), L = selList(), one = L.length === 1 ? L[0] : null;
    const rows = [];
    if (L.length) {
      if (one && one.t === "s" && !one.lk) rows.push(["Sửa chữ", "Enter", () => startEdit(one.id)]);
      if (one && one.t === "l" && !one.lk) rows.push(["Chữ trên đường nối", "Enter", () => editLabel(one.id)]);
      rows.push(["Sao chép", "Ctrl+C", () => copySel()], ["Cắt", "Ctrl+X", () => copySel(true)], ["Nhân bản", "Ctrl+D", dupSel], 0,
        ["Đưa lên trên cùng", "Ctrl+Alt+]", () => layer("front")], ["Đưa xuống dưới cùng", "Ctrl+Alt+[", () => layer("back")],
        [L.every(i => i.lk) ? "Mở khoá" : "Khoá", "", lockSel], ["Xoá", "Delete", delSel], 0);
    }
    rows.push(["Dán", "Ctrl+V", () => { let d = null; try { d = JSON.parse(localStorage.getItem("vm.dgclip") || "null"); } catch {} if (d) pasteItems(d); }],
      ["Thêm hình ở đây", "R", () => { const [W, H] = SIZE.round, it = newShape("round", w.x - W / 2, w.y - H / 2, W, H); items.push(it); sel = new Set([it.id]); render(); commit(); }],
      ["Thêm chữ ở đây", "T", () => { const it = newShape("text", w.x, w.y - 18, 60, 36); items.push(it); render(); startEdit(it.id, ""); }],
      ["Chọn tất cả", "Ctrl+A", selectAll], ["Xem toàn bộ", "Shift+1", () => fitTo(items)]);
    menu.innerHTML = rows.map((r, i) => r ? `<button type="button" data-i="${i}"><span>${esc(r[0])}</span><kbd>${esc(r[1])}</kbd></button>` : "<hr>").join("");
    menu.onclick = ev => { const b = ev.target.closest("[data-i]"); if (!b) return; closeMenu(); rows[+b.dataset.i][2](); };
    menu.hidden = false;
    menu.style.left = clamp(e.clientX - s.left, 4, stage.clientWidth - menu.offsetWidth - 4) + "px"; menu.style.top = clamp(e.clientY - s.top, 4, stage.clientHeight - menu.offsetHeight - 4) + "px";
  });
  function closeMenu() { menu.hidden = true; }
  stage.addEventListener("wheel", e => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) zoomAt(view.z * Math.exp(-e.deltaY * (e.deltaMode ? .05 : .0025)), e.clientX, e.clientY);
    else { view.x -= e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX; view.y -= e.shiftKey && !e.deltaX ? 0 : e.deltaY; applyView(); placeCtx(); }
  }, {passive: false});
  function zoomAt(z, cx, cy) {
    z = clamp(z, .1, 4); const r = svg.getBoundingClientRect(); if (cx == null) { cx = r.left + r.width / 2; cy = r.top + r.height / 2; }
    const wx = (cx - r.left - view.x) / view.z, wy = (cy - r.top - view.y) / view.z;
    view = {z, x: cx - r.left - wx * z, y: cy - r.top - wy * z}; applyView(); renderUI(); placeCtx();
  }
  function fitTo(list) {
    const b = union(list.length ? list : items, map()); const W = stage.clientWidth || 800, H = stage.clientHeight || 500;
    if (!b) { view = {x: W / 2, y: H / 2, z: 1}; applyView(); return; }
    const narrow = W <= 760, padL = narrow ? 16 : 110, padR = narrow ? 16 : 50, padT = narrow ? 60 : 70, padB = narrow ? 140 : 60;
    const z = clamp(Math.min((W - padL - padR) / (b.x1 - b.x0 || 1), (H - padT - padB) / (b.y1 - b.y0 || 1)), .1, 1.5);
    view = {z, x: padL + (W - padL - padR - (b.x1 - b.x0) * z) / 2 - b.x0 * z, y: padT + (H - padT - padB - (b.y1 - b.y0) * z) / 2 - b.y0 * z}; applyView(); renderUI(); placeCtx();
  }

  /* ---------- thanh trên, thu phóng ---------- */
  root.addEventListener("click", e => {
    const b = e.target.closest("[data-a]"); if (!b) return;
    const a = b.dataset.a;
    if (a === "undo") doUndo(); else if (a === "redo") doRedo();
    else if (a === "zin") zoomAt(view.z * 1.25); else if (a === "zout") zoomAt(view.z / 1.25); else if (a === "z100") zoomAt(1); else if (a === "fit") fitTo(items);
    else if (a === "png") downloadPng(items, titleIn ? titleIn.value : "so-do");
    else if (a === "close") close();
    else if (a === "help") help();
  });
  function help() {
    const r = q('[data-a="help"]').getBoundingClientRect(), s = stage.getBoundingClientRect();
    pop.onclick = null;
    pop.innerHTML = `<div class="dg-help"><div class="dg-ph">Cách dùng (giống Canva)</div><ul>
      <li>Chọn <b>Hình</b> bên trái rồi bấm vào trang (kéo để vẽ đúng cỡ).</li>
      <li>Chọn một hình → bấm nút <b>+</b> ở cạnh để thêm hình nối theo hướng đó; <b>kéo</b> nút + sang hình khác để vẽ đường nối, thả ra chỗ trống để chọn hình mới.</li>
      <li><b>Bấm đúp</b> (hoặc cứ gõ phím khi đang chọn hình) để gõ chữ. Bấm đúp vào đường để thêm chữ trên đường.</li>
      <li>Thanh nổi phía trên mục đang chọn: màu nền, viền, cỡ chữ, đậm, căn chữ, kiểu đường, mũi tên…</li>
      <li>Kéo hình có đường căn tím; kéo đầu đường nối để nối sang hình khác.</li></ul>
      <div class="dg-ph">Phím tắt</div><table>
      ${[["V / R / C / L / T / S / D", "Chọn / Chữ nhật / Tròn / Đường / Chữ / Note / Vẽ"], ["Ctrl+Z, Ctrl+Y", "Hoàn tác, làm lại"], ["Ctrl+C, X, V, D", "Sao chép, cắt, dán, nhân bản"],
        ["Delete", "Xoá"], ["Mũi tên (Shift)", "Dịch 1 (10) điểm"], ["Alt + kéo", "Nhân bản khi kéo"], ["Shift + kéo góc", "Giữ tỉ lệ"], ["Ctrl+B, Ctrl+I", "Đậm, nghiêng"],
        ["Ctrl+] [, Ctrl+Alt+] [", "Lên / xuống lớp, trên / dưới cùng"], ["Ctrl + lăn chuột", "Thu phóng"], ["Giữ Space + kéo, chuột giữa", "Kéo trang"], ["Shift+1, Ctrl+0", "Xem toàn bộ, 100%"], ["Esc", "Bỏ chọn / thôi công cụ"]]
        .map(([k, v]) => `<tr><td><kbd>${k}</kbd></td><td>${v}</td></tr>`).join("")}</table></div>`;
    openPop({x: r.left - s.left - 200, y: 8});
  }
  if (titleIn) {
    let tt;
    titleIn.addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Enter") titleIn.blur(); });
    titleIn.addEventListener("input", () => { clearTimeout(tt); status("Đang lưu…"); tt = setTimeout(async () => { try { await (opts.saveTitle && opts.saveTitle(titleIn.value)); status("Đã lưu"); } catch { status("Chưa lưu được"); } }, 800); });
  }

  /* ---------- phím ---------- */
  function onKey(e) {
    if (active !== api || destroyed || !root.isConnected || !root.offsetParent && !opts.full) return;
    const tg = e.target; if (tg && (tg.closest && !root.contains(tg) && tg !== document.body)) return;
    if (tg && (tg.tagName === "INPUT" || tg.tagName === "TEXTAREA" || tg.isContentEditable)) return;
    const k = e.key, mod = e.ctrlKey || e.metaKey, L = selList();
    if (k === " ") { space = true; stage.classList.add("dg-handc"); e.preventDefault(); return; }
    if (mod) {
      const kl = k.toLowerCase();
      if (kl === "z") { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); return; }
      if (kl === "y") { e.preventDefault(); doRedo(); return; }
      if (kl === "c") { if (L.length) { e.preventDefault(); copySel(); } return; }
      if (kl === "x") { if (L.length) { e.preventDefault(); copySel(true); } return; }
      if (kl === "d") { e.preventDefault(); dupSel(); return; }
      if (kl === "a") { e.preventDefault(); selectAll(); return; }
      if (kl === "b" || kl === "i") { const S = L.filter(i => i.t === "s"); if (!S.length) return; e.preventDefault(); const f = kl === "b" ? "b" : "it", v = S.every(i => i[f]) ? 0 : 1; apply(it => { if (it.t === "s") it[f] = v; }); return; }
      if (k === "]" || k === "[") { e.preventDefault(); layer(k === "]" ? (e.altKey ? "front" : "up") : (e.altKey ? "back" : "down")); return; }
      if (k === "=" || k === "+") { e.preventDefault(); zoomAt(view.z * 1.25); return; }
      if (k === "-") { e.preventDefault(); zoomAt(view.z / 1.25); return; }
      if (k === "0") { e.preventDefault(); zoomAt(1); return; }
      return;
    }
    if (k === "Delete" || k === "Backspace") { if (L.length) { e.preventDefault(); delSel(); } return; }
    if (k === "Escape") {
      if (!pop.hidden || !menu.hidden) { closePop(); closeMenu(); return; }
      if (tool !== "select") { setTool("select"); return; }
      if (L.length) { sel.clear(); render(); return; }
      if (opts.onClose) close();
      return;
    }
    if (k.startsWith("Arrow") && L.length) {
      e.preventDefault(); const s = e.shiftKey ? 10 : 1, dx = k === "ArrowLeft" ? -s : k === "ArrowRight" ? s : 0, dy = k === "ArrowUp" ? -s : k === "ArrowDown" ? s : 0;
      for (const it of L) { if (it.lk) continue; if (it.t === "s") { it.x += dx; it.y += dy; } else if (it.t === "d") it.pts = it.pts.map(p => [p[0] + dx, p[1] + dy]); else for (const x of ["a", "b"]) if (it[x].x != null) { it[x].x += dx; it[x].y += dy; } }
      render(); clearTimeout(onKey.t); onKey.t = setTimeout(commit, 400); return;
    }
    if (k === "Enter" && L.length === 1) { e.preventDefault(); if (L[0].t === "s") startEdit(L[0].id); else if (L[0].t === "l") editLabel(L[0].id); return; }
    if (k === "!" && e.shiftKey) { fitTo(items); return; }
    if (L.length === 1 && L[0].t === "s" && !L[0].lk && k.length === 1 && !e.altKey) { e.preventDefault(); startEdit(L[0].id, k); return; }   // gõ luôn vào hình đang chọn
    if (e.altKey) return;
    const tk = {v: ["select"], r: ["shape", "rect"], c: ["shape", "ellipse"], l: ["line"], t: ["text"], s: ["sticky"], d: ["pen"], h: ["hand"]}[k.toLowerCase()];
    if (tk) { e.preventDefault(); setTool(tk[0], tk[1]); }
  }
  function onKeyUp(e) { if (e.key === " ") { space = false; stage.classList.toggle("dg-handc", tool === "hand"); } }
  function onPaste(e) {
    if (active !== api || destroyed || !root.isConnected) return;
    const tg = e.target; if (tg && (tg.tagName === "INPUT" || tg.tagName === "TEXTAREA" || tg.isContentEditable)) return;
    if (tg && tg.closest && !root.contains(tg) && tg !== document.body) return;
    const txt = (e.clipboardData && e.clipboardData.getData("text/plain")) || "";
    e.preventDefault();
    if (txt.startsWith(CLIP)) { try { pasteItems(JSON.parse(txt.slice(CLIP.length))); } catch {} return; }
    if (txt.trim()) { const c = center(), it = newShape("text", c.x, c.y, 60, 36); it.txt = txt.trim().slice(0, 4000); items.push(it); fit(it); it.x -= it.w / 2; sel = new Set([it.id]); render(); commit(); return; }
    let d = null; try { d = JSON.parse(localStorage.getItem("vm.dgclip") || "null"); } catch {} if (d) pasteItems(d);
  }
  document.addEventListener("keydown", onKey);
  document.addEventListener("keyup", onKeyUp);
  document.addEventListener("paste", onPaste);
  root.addEventListener("pointerdown", () => { active = api; }, true);
  const ro = new ResizeObserver(() => { applyView(); placeCtx(); }); ro.observe(stage);

  function close() { if (editingId) finishEdit(); flush(); opts.onClose && opts.onClose(); }
  function destroy() {
    if (editingId) finishEdit();
    destroyed = true; ro.disconnect();
    document.removeEventListener("keydown", onKey); document.removeEventListener("keyup", onKeyUp); document.removeEventListener("paste", onPaste);
    if (active === api) active = null; host.innerHTML = "";
  }
  const api = {destroy, flush: () => { if (editingId) finishEdit(); return flush(); }, data: () => ({v: 1, items: clone(items)}), hasPending: () => !!pending};
  active = api; syncTop(); setTool("select");
  requestAnimationFrame(() => { fitTo(items); stage.focus({preventScroll: true}); });
  if (opts.data && opts.data.bad) status("Khối sơ đồ hỏng, đang mở sơ đồ trống");
  return api;
}

/* ---------------------------------------------------------------- vẽ toàn màn hình (sơ đồ nằm trong tài liệu) */
function openFull(opts) {
  const ov = document.createElement("div"); ov.className = "dg-overlay"; document.body.appendChild(ov); document.body.classList.add("dg-lock");
  let ed = null;
  const done = async () => { await ed.flush(); ed.destroy(); ov.remove(); document.body.classList.remove("dg-lock"); opts.onClosed && opts.onClosed(); };
  ed = mount(ov, {...opts, full: true, onClose: done});
  return ed;
}

/* trong trang xem tài liệu: khối ```vmdiagram → hình xem trước, bấm để vẽ toàn màn hình */
function decorate(el, opts = {}) {
  el.querySelectorAll("pre > code.language-vmdiagram").forEach((code, k) => {
    const data = parse(code.textContent), pre = code.parentElement;
    const card = document.createElement("div"); card.className = "dgv" + (opts.interactive ? " can" : "");
    const s = data.items.length ? svgString(clone(data.items), 30).svg : "";
    card.innerHTML = `<div class="dgv-body">${s || '<div class="dgv-empty">Sơ đồ trống — bấm để vẽ</div>'}</div>
      <div class="dgv-bar"><span>◇ Sơ đồ${data.bad ? " (khối hỏng)" : ""}</span>${opts.interactive ? '<button type="button" class="dgv-edit">✎ Sửa sơ đồ</button>' : ""}<button type="button" class="dgv-png" title="Tải PNG">⤓ PNG</button></div>`;
    const svgEl = card.querySelector(".dgv-body svg"); if (svgEl) { svgEl.removeAttribute("width"); svgEl.removeAttribute("height"); }
    pre.replaceWith(card);
    card.querySelector(".dgv-png").onclick = e => { e.stopPropagation(); downloadPng(data.items, opts.title || "so-do"); };
    if (opts.interactive) card.onclick = () => openFull({data, save: d => opts.save(k, d), onClosed: opts.onClosed});
  });
}

/* ---------------------------------------------------------------- giao diện */
const css = document.createElement("style");
css.textContent = `
.dg-root{display:flex;flex-direction:column;height:100%;min-height:0;background:#fff;color:#1f2330;font-family:${FONT};font-size:14px;line-height:1.4;position:relative}
.dg-root *{box-sizing:border-box}
.dg-root [hidden]{display:none!important}
.dg-root button{font:inherit;color:inherit}
.dg-top{display:flex;align-items:center;gap:4px;padding:6px 10px;border-bottom:1px solid #e6e7ec;background:#fff;flex-wrap:wrap;position:relative;z-index:6}
.dg-b{display:inline-flex;align-items:center;gap:6px;border:0;background:none;border-radius:8px;padding:6px 8px;cursor:pointer;min-height:34px}
.dg-b:hover:not(:disabled){background:#f1f1f5}.dg-b:disabled{opacity:.35;cursor:default}
.dg-back{font-weight:600;background:#f1effd;color:#5b2bd1}.dg-back:hover{background:#e6e0fc!important}
.ic{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
.dg-title{border:1px solid transparent;border-radius:8px;padding:6px 8px;font:600 15px ${FONT};color:#1f2330;background:none;min-width:120px;width:min(360px,40vw)}
.dg-title:hover{border-color:#e0e1e8}.dg-title:focus{outline:none;border-color:${SEL};background:#fff}
.dg-name{font-weight:600;padding:0 8px}
.dg-vsep{width:1px;height:22px;background:#e6e7ec;margin:0 4px}.dg-sp{flex:1}
.dg-status{color:#7b7f8e;font-size:12px;padding:0 8px;white-space:nowrap}
.dg-stage{flex:1;min-height:0;position:relative;overflow:hidden;outline:none;background-color:#fff;background-image:radial-gradient(#dcdfe6 1.1px,transparent 1.3px);touch-action:none;user-select:none;-webkit-user-select:none}
.dg-stage.dg-cross .dg-svg{cursor:crosshair}.dg-stage.dg-handc .dg-svg{cursor:grab}.dg-stage.dg-panning .dg-svg{cursor:grabbing}
.dg-svg{position:absolute;inset:0;width:100%;height:100%;display:block}
.dg-cn{cursor:default}.dg-cn circle{transition:fill .12s}.dg-cn:hover circle{fill:#e4dcfb}
.dg-tools{position:absolute;left:12px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:2px;padding:6px;background:#fff;border-radius:14px;box-shadow:0 2px 12px rgba(20,20,40,.14),0 0 0 1px rgba(20,20,40,.05);z-index:4}
.dg-tools button{display:flex;flex-direction:column;align-items:center;gap:2px;width:54px;padding:7px 2px 5px;border:0;background:none;border-radius:10px;cursor:pointer;font-size:11px;color:#3a3e4c}
.dg-tools button:hover{background:#f1f1f5}.dg-tools button.on,.dg-tools button.open{background:#f1effd;color:#5b2bd1}
.dg-hsep{height:1px;background:#ececf1;margin:3px 6px}
.dg-ctx{position:absolute;display:flex;align-items:center;gap:2px;padding:4px;background:#fff;border-radius:12px;box-shadow:0 4px 18px rgba(20,20,40,.16),0 0 0 1px rgba(20,20,40,.05);z-index:5;white-space:nowrap}
.dg-cb{display:inline-flex;align-items:center;justify-content:center;gap:4px;min-width:34px;height:34px;padding:0 7px;border:0;background:none;border-radius:8px;cursor:pointer;font-size:14px}
.dg-cb:hover{background:#f1f1f5}.dg-cb.on{background:#f1effd;color:#5b2bd1}
.dg-cb span{font-size:13px}
.dg-csep{width:1px;height:22px;background:#e6e7ec;margin:0 3px}
.dg-sw{display:inline-block;width:22px;height:22px;border-radius:50%;border:1px solid rgba(0,0,0,.15)}.dg-sw.ln{border-radius:4px;height:8px;width:24px}.dg-sw.big{width:34px;height:34px;border-radius:6px}
.dg-cb.none .dg-sw{background:linear-gradient(135deg,transparent 45%,#e33 46%,#e33 54%,transparent 55%)!important}
.dg-bd{display:inline-block;width:20px;height:20px;border-radius:4px;border-width:2.5px}
.dg-A{font-weight:700;border-bottom:4px solid;line-height:1;padding:0 3px 1px;font-size:16px}
.dg-fs{width:46px;height:30px;border:1px solid #e0e1e8;border-radius:7px;text-align:center;font:inherit;-moz-appearance:textfield}
.dg-fs::-webkit-inner-spin-button{display:none}
.shi{width:30px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8}.dg-cb .shi{width:26px}
.dg-pop,.dg-menu{position:absolute;background:#fff;border-radius:12px;box-shadow:0 6px 24px rgba(20,20,40,.18),0 0 0 1px rgba(20,20,40,.05);padding:10px;z-index:7;max-width:320px;max-height:calc(100% - 16px);overflow:auto}
.dg-ph{font-weight:600;font-size:13px;margin:0 0 8px}.dg-sub{font-size:12px;color:#7b7f8e;margin:8px 0 6px}
.dg-grid{display:grid;grid-template-columns:repeat(4,56px);gap:6px}
.dg-grid .dg-po{height:48px;justify-content:center;padding:0}.dg-grid .shi{width:40px;height:28px;fill:#d6daf8;stroke:#1f3f99}
.dg-list{display:flex;flex-direction:column;gap:2px;min-width:190px}.dg-list hr,.dg-menu hr{border:0;border-top:1px solid #ececf1;margin:4px 0}
.dg-po{display:flex;align-items:center;gap:10px;border:1px solid transparent;background:none;border-radius:8px;padding:6px 8px;cursor:pointer;text-align:left}
.dg-po .tpi{width:48px;height:32px;flex:none;fill:#fff;stroke:#1f3f99;stroke-width:1.3}
.dg-po:hover{background:#f1f1f5}.dg-po.on{border-color:${SEL};background:#f6f3ff}
.dg-po kbd,.dg-menu kbd{margin-left:auto;color:#9a9dab;font:12px ${FONT}}
.dg-cols{display:grid;grid-template-columns:repeat(6,30px);gap:7px}
.dg-c{width:30px;height:30px;border-radius:50%;border:1px solid rgba(0,0,0,.14);cursor:pointer;padding:0}
.dg-c.on{outline:2px solid ${SEL};outline-offset:2px}.dg-none{background:linear-gradient(135deg,#fff 45%,#e33 46%,#e33 54%,#fff 55%)!important}
.dg-custom{display:flex;align-items:center;gap:8px;margin-top:10px;font-size:13px;cursor:pointer}.dg-custom input{width:40px;height:28px;border:0;padding:0;background:none;cursor:pointer}
.dg-rng{width:100%;accent-color:${SEL}}
.dg-tip{font-size:12px;color:#6b6f7e;margin:10px 0 0;max-width:250px}
.dg-menu{padding:6px;min-width:230px}.dg-menu button{display:flex;width:100%;align-items:center;gap:10px;border:0;background:none;padding:7px 10px;border-radius:7px;cursor:pointer;text-align:left}
.dg-menu button:hover{background:#f1f1f5}
.dg-help{max-width:300px;font-size:13px}.dg-help ul{margin:0 0 10px;padding-left:18px}.dg-help li{margin:4px 0}.dg-help table{border-collapse:collapse;width:100%}
.dg-help td{padding:3px 4px;vertical-align:top;border-top:1px solid #f0f0f4}.dg-help kbd{font:11px ${FONT};background:#f1f1f5;border-radius:4px;padding:1px 5px;white-space:nowrap}
.dg-hint{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);background:#1f2330;color:#fff;font-size:13px;padding:7px 14px;border-radius:999px;z-index:4;pointer-events:none;white-space:nowrap}
.dg-empty{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);text-align:center;color:#8a8e9c;pointer-events:none;display:flex;flex-direction:column;gap:6px;max-width:320px}
.dg-empty>b{font-size:16px;color:#4a4e5c}
.dg-zoom{position:absolute;right:12px;bottom:12px;display:flex;align-items:center;gap:2px;background:#fff;border-radius:10px;padding:3px;box-shadow:0 2px 10px rgba(20,20,40,.12),0 0 0 1px rgba(20,20,40,.05);z-index:4}
.dg-zoom button{border:0;background:none;min-width:30px;height:30px;border-radius:7px;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center}
.dg-zoom button:hover{background:#f1f1f5}.dg-zoom .dg-zl{font-size:12px;min-width:48px}.dg-zoom .ic{width:17px;height:17px}
.dg-caret{animation:dgBlink 1.05s steps(1) infinite}@keyframes dgBlink{50%{opacity:0}}
.dg-edit{position:absolute;display:flex;justify-content:center;z-index:3;pointer-events:none}
.dg-ed{pointer-events:auto;outline:none;font-family:${FONT};max-width:100%;caret-color:${SEL};overflow-wrap:break-word;word-break:break-word;user-select:text;-webkit-user-select:text;cursor:text}
.dg-lbl{position:absolute;width:240px;z-index:6;padding:7px 10px;border:2px solid ${SEL};border-radius:8px;font:14px ${FONT};outline:none;background:#fff;color:#1f2330}
.dg-overlay{position:fixed;inset:0;z-index:3000;background:#fff}
body.dg-lock{overflow:hidden}
.dgv{margin:16px 0;border:1px solid var(--line,#ddd);border-radius:12px;overflow:hidden;background:#fff}
.dgv.can{cursor:pointer}.dgv.can:hover{border-color:${SEL};box-shadow:0 0 0 1px ${SEL}}
.dgv-body{padding:8px;display:flex;justify-content:center;background:#fff}
.dgv-body svg{width:100%;height:auto;max-height:560px;display:block}
.dgv-empty{padding:50px 10px;color:#8a8e9c}
.dgv-bar{display:flex;align-items:center;gap:8px;padding:6px 10px;border-top:1px solid var(--line,#eee);background:var(--bg,#f7f7f9);font-size:13px;color:var(--muted,#666)}
.dgv-bar span{flex:1}.dgv-bar button{font-size:13px;padding:3px 10px}
@media (max-width:760px){.dg-tools{top:auto;bottom:56px;left:50%;transform:translateX(-50%);flex-direction:row}.dg-tools button{width:44px}.dg-hsep{width:1px;height:auto;margin:6px 3px}
  .dg-b span{display:none}.dg-title{width:40vw}.dg-ctx{max-width:calc(100% - 16px);overflow-x:auto}}
@media (prefers-color-scheme:dark){.dgv,.dgv-body{background:#fff}}
#wys pre:has(code.language-vmdiagram){max-height:46px;overflow:hidden;background:#f6f3ff!important;border:1px dashed ${SEL}}
#wys pre:has(code.language-vmdiagram)::before{content:"◇ Sơ đồ — bấm Lưu rồi bấm vào sơ đồ để vẽ (muốn xoá: bấm Mã nguồn)";display:block;color:#5b2bd1;font:13px ${FONT}}
#wys pre:has(code.language-vmdiagram) code{display:none}`;
document.head.appendChild(css);

window.VMDiagram = {mount, openFull, decorate, parse, serialize, block, blocks, replaceBlock, setTitle, isFile, titleOf, newFileText, template, svgString, downloadPng};
})();
