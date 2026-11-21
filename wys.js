/* Soạn thảo trực quan kiểu Word / Google Docs (Tiptap): gõ, kéo thả, dán ảnh ngay trên trang đã định dạng.
   Vẫn lưu ra Markdown. Nút "Mã nguồn" chuyển sang ô Markdown thô khi cần.
   Trang chủ định nghĩa: window.wysHooks = { upload(files) -> Promise<[{src, alt}]>, imgSrc(imgEl, src), dirty() } */
(() => {
const $ = s => document.querySelector(s);
const W = {ed: null, orig: "", touched: false};
const hooks = () => window.wysHooks || {};
const pref = () => { try { return localStorage.getItem("vm.editmode") === "src" ? "src" : "wys"; } catch { return "wys"; } };
const setPref = v => { try { localStorage.setItem("vm.editmode", v); } catch {} };
let ready = false;

function setup() {                                                   // thêm vùng soạn thảo và nút vào giao diện có sẵn
  if (ready) return; ready = true;
  const editor = $("#editor"), tb = $("#toolbar");
  const wrap = document.createElement("div"); wrap.className = "scroll wys-wrap"; wrap.id = "wysWrap"; wrap.innerHTML = `<article id="wys"></article>`;
  editor.appendChild(wrap);
  const tools = document.createElement("span"); tools.id = "tblTools"; tools.className = "hidden";
  tools.innerHTML = `<span class="sep"></span><button type="button" data-act="addrow" title="Thêm hàng bên dưới">＋ Hàng</button><button type="button" data-act="addcol" title="Thêm cột bên phải">＋ Cột</button><button type="button" data-act="delrow" title="Xoá hàng đang chọn">− Hàng</button><button type="button" data-act="delcol" title="Xoá cột đang chọn">− Cột</button><button type="button" data-act="deltable" title="Xoá cả bảng">Xoá bảng</button>`;
  tb.appendChild(tools);
  const mode = document.createElement("button"); mode.type = "button"; mode.id = "modeBtn"; mode.dataset.act = "mode"; mode.className = "mode-btn";
  tb.appendChild(mode);
  tb.addEventListener("click", e => {                                // bắt trước các nút soạn thảo thô của trang
    const b = e.target.closest("button[data-act]"); if (!b) return;
    const a = b.dataset.act;
    if (a === "mode") { e.stopImmediatePropagation(); toggle(); return; }
    if (!W.ed) return;
    e.stopImmediatePropagation();
    if (a === "image") { $("#imgPick").click(); return; }
    W.ed.run(a);
  }, true);
}
function label() { const b = $("#modeBtn"); if (b) b.textContent = W.ed ? "</> Mã nguồn" : "✎ Soạn trực quan"; if (b) b.title = W.ed ? "Chuyển sang ô Markdown thô" : "Quay lại soạn thảo trực quan"; }
function sync() {
  if (!W.ed) return; const a = W.ed.active();
  document.querySelectorAll("#toolbar button[data-act]").forEach(b => b.classList.toggle("on", !!a[b.dataset.act]));
  $("#tblTools").classList.toggle("hidden", !a.inTable);
}
function start(md) {
  const host = $("#wys"); host.innerHTML = "";
  W.ed = window.VMEditor.create(host, {
    markdown: md,
    onChange: () => { W.touched = true; hooks().dirty && hooks().dirty(); },
    onSelection: sync,
    upload: files => hooks().upload(files),
    imgSrc: (img, src) => hooks().imgSrc ? hooks().imgSrc(img, src) : (img.src = src),
  });
  label(); sync(); W.ed.focus();
}
function stop() { if (W.ed) { W.ed.destroy(); W.ed = null; } $("#wys") && ($("#wys").innerHTML = ""); }

function open(text, path) {
  setup(); W.orig = text; W.touched = false; stop();
  const wys = pref() === "wys" && !!window.VMEditor;
  $("#editor").classList.toggle("wys", wys);
  if (wys) start(text);
  else { const s = $("#src"); s.value = text; render($("#preview"), text, path, false); label(); s.focus(); }
}
function close() { stop(); const e = $("#editor"); e && e.classList.remove("wys"); }
function text() { return W.ed ? (W.touched ? W.ed.getMarkdown() : W.orig) : $("#src").value; }
function toggle() {
  const md = text();
  if (W.ed) {                                                        // → mã nguồn
    stop(); setPref("src"); $("#editor").classList.remove("wys");
    const s = $("#src"); s.value = md; render($("#preview"), md, cur.path, false); label(); s.focus();
  } else if (window.VMEditor) {                                      // → trực quan
    setPref("wys"); $("#editor").classList.add("wys"); W.touched = md !== W.orig; start(md);
  }
}

const css = document.createElement("style");
css.textContent = `
.editor .wys-wrap{display:none}.editor.wys .wys-wrap{display:block;grid-column:1/-1;background:var(--bg)}
.editor.wys textarea,.editor.wys .scroll:not(.wys-wrap){display:none}
#wys{outline:none;min-height:100%}#wys .wys-doc{outline:none;min-height:70vh;padding-bottom:30vh}
#wys p.is-editor-empty:first-child::before{content:attr(data-placeholder);float:left;height:0;color:var(--muted);pointer-events:none}
.toolbar button.on{background:var(--accent-soft);color:var(--accent);border-color:var(--accent)}
.toolbar .mode-btn{margin-left:auto}
.editor:not(.wys) .toolbar .wys-only{display:none}
.toolbar mark.hl{background:#ffe066;color:#3b2a00;padding:0 3px;border-radius:3px}
#wys mark,article mark{background:#ffe066;color:#3b2a00;border-radius:2px;padding:0 1px}
#tblTools{display:inline-flex;align-items:center;gap:4px}
#wys ul[data-type=taskList]{list-style:none;padding-left:4px}
#wys li[data-checked]{display:flex;align-items:flex-start;gap:8px;margin:8px 0}
#wys li[data-checked]>label{flex:0 0 auto;margin-top:.35em;user-select:none}
#wys li[data-checked]>label input{width:16px;height:16px;margin:0;accent-color:var(--ok);cursor:pointer}
#wys li[data-checked]>div{flex:1;min-width:0}#wys li[data-checked]>div>p{margin:0}
#wys li[data-checked=true]>div{color:var(--muted)}
#wys li>p{margin:.2em 0}
#wys .tok{opacity:.5;font-size:.88em}
#wys .tableWrapper{overflow-x:auto;margin:14px 0}#wys table{table-layout:fixed;margin:0;width:100%}
#wys th,#wys td{position:relative;vertical-align:top;min-width:60px}#wys th p,#wys td p{margin:0}
#wys .selectedCell::after{content:"";position:absolute;inset:0;background:var(--accent-soft);opacity:.7;pointer-events:none}
#wys img{max-width:100%;border-radius:6px;cursor:default;vertical-align:bottom}#wys .ProseMirror-selectednode{outline:2px solid var(--accent);outline-offset:2px}
#wys hr.ProseMirror-selectednode{outline:2px solid var(--accent)}
#wys a{cursor:text}
@media (max-width:760px){.editor.wys .wys-wrap{display:block}.toolbar .mode-btn{margin-left:0}}`;
document.head.appendChild(css);

window.VMWys = {open, close, text, isWys: () => !!W.ed, insertImages: l => W.ed && W.ed.insertImages(l), insertLink: (t, h) => W.ed && W.ed.insertLink(t, h)};
})();
