// 汎用ヘルパー

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
export const enc = encodeURIComponent;

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 改行区切りのセルを配列に
export const lines = (s) => String(s || "").split(/\r?\n/).map((t) => t.trim()).filter(Boolean);

// 検索用の正規化：全角半角・大文字小文字・カタカナ/ひらがなを揃える
export function normalize(s) {
  return String(s || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[\s・･\-ー]/g, "");
}

export function isAsk(price) {
  return /^ask/i.test(String(price || "").normalize("NFKC").trim());
}

export function priceNumber(price) {
  const t = String(price || "").normalize("NFKC").replace(/[,円¥\s]/g, "");
  if (!t || isNaN(Number(t))) return null;
  return Number(t);
}

export function formatPrice(price) {
  if (isAsk(price)) return "ASK（時価）";
  const n = priceNumber(price);
  if (n != null) return n.toLocaleString("ja-JP") + "円";
  return String(price || "").trim();
}

const SERVE = { R: "ロック", ST: "ストレート", S: "ソーダ割り" };
export function formatServe(s) {
  return String(s || "")
    .normalize("NFKC")
    .split(/[,/、\s]+/)
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
    .map((t) => SERVE[t] || t)
    .join(" / ");
}

// 「ドライ・ジン 45ml」→「ドライ・ジン」（最後のトークンが分量なら外す）
const AMOUNT = /^(約|適量|少量|少々|お好み|[0-9０-９½¼¾]|1\/)/;
export function ingredientName(line) {
  const parts = line.split(/\s+/);
  if (parts.length > 1 && AMOUNT.test(parts[parts.length - 1])) parts.pop();
  return parts.join(" ");
}

// Googleドライブの共有リンク（…/file/d/ID/view、…open?id=ID など）は画像として表示できる形に変換
const DRIVE_ID = /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:.*&)?id=|thumbnail\?(?:.*&)?id=)([\w-]{10,})/;

export function imageUrl(d) {
  const v = String(d.image || "").trim();
  if (!v) return "";
  const drive = v.match(DRIVE_ID);
  if (drive) return `https://drive.google.com/thumbnail?id=${drive[1]}&sz=w800`;
  if (/^https?:\/\//i.test(v)) return v;
  return "images/" + v.replace(/^\.?\/?(images\/)?/, "");
}

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

let toastTimer;
export function toast(msg, ms = 2400) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), ms);
}

export function formatDate(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// 横スワイプ検出。縦スクロールはブラウザに任せる（要素に touch-action: pan-y を付ける）
export function onSwipe(el, { onMove, onEnd, threshold = 60 } = {}) {
  let sx = 0, sy = 0, dx = 0, active = false, horizontal = null, id = null;
  const down = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    sx = e.clientX; sy = e.clientY; dx = 0; active = true; horizontal = null; id = e.pointerId;
  };
  const move = (e) => {
    if (!active || e.pointerId !== id) return;
    dx = e.clientX - sx;
    const dy = e.clientY - sy;
    if (horizontal === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      horizontal = Math.abs(dx) > Math.abs(dy);
      if (horizontal) el.setPointerCapture?.(id);
    }
    if (horizontal) onMove?.(dx);
  };
  const up = (e) => {
    if (!active || e.pointerId !== id) return;
    active = false;
    if (horizontal) {
      el.dataset.swiped = "1";
      setTimeout(() => delete el.dataset.swiped, 50);
      const dir = dx > threshold ? 1 : dx < -threshold ? -1 : 0;
      onEnd?.(dir, dx);
    }
  };
  const cancel = () => {
    if (active && horizontal) onEnd?.(0, 0);
    active = false;
  };
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", cancel);
  return () => {
    el.removeEventListener("pointerdown", down);
    el.removeEventListener("pointermove", move);
    el.removeEventListener("pointerup", up);
    el.removeEventListener("pointercancel", cancel);
  };
}
