// ハッシュルーター
// 履歴エントリごとに番号(idx)を history.state に刻み、
// 「新しく進んだ画面」と「戻る/進むで再訪した画面」を見分けてスクロール位置を復元する。

const routes = [];
const cur = { idx: -1, path: "", query: new URLSearchParams() };
let els = {};
let cleanup = null;
let backTarget = null;
let pendingReplace = false;
let scrollMap = {};
try {
  scrollMap = JSON.parse(sessionStorage.getItem("barapp.scroll") || "{}");
} catch {
  /* noop */
}

export const addRoute = (re, fn) => routes.push([re, fn]);
export const currentPath = () => cur.path;

export function navigate(hash, { replace = false } = {}) {
  if (location.hash === hash || decodeURIComponent(location.hash) === decodeURIComponent(hash)) {
    render(false);
    return;
  }
  if (replace) {
    pendingReplace = true;
    location.replace(hash);
  } else {
    location.hash = hash;
  }
}

// アプリ内に戻れる履歴があれば戻る、なければ親画面へ
export function goBack(fallback = "#/menu") {
  if (cur.idx > 0) history.back();
  else navigate(fallback, { replace: true });
}

export function setChrome({ title = "", back = null, tab = null, tabs = true }) {
  els.title.textContent = title;
  backTarget = back;
  els.back.hidden = !back;
  document.body.classList.toggle("no-tabs", !tabs);
  els.tabs.forEach((a) => {
    const on = a.dataset.tab === tab;
    a.classList.toggle("active", on);
    if (on) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

function parseHash() {
  const h = location.hash.replace(/^#\/?/, "");
  const [p, q = ""] = h.split("?");
  return { path: p.replace(/\/+$/, ""), query: new URLSearchParams(q) };
}

function onHashChange() {
  let st = history.state;
  let isNew = false;
  if (!st || typeof st.idx !== "number") {
    st = { idx: pendingReplace ? Math.max(cur.idx, 0) : cur.idx + 1 };
    history.replaceState(st, "", location.href);
    isNew = true;
  }
  pendingReplace = false;
  cur.idx = st.idx;
  render(!isNew);
}

export function rerender() {
  render(true);
}

function render(restore) {
  if (cleanup) {
    try {
      cleanup();
    } catch {
      /* noop */
    }
    cleanup = null;
  }
  const { path, query } = parseHash();
  cur.path = path;
  cur.query = query;
  for (const [re, fn] of routes) {
    const m = path.match(re);
    if (!m) continue;
    const params = m.slice(1).map((s) => decodeURIComponent(s));
    const out = fn({ view: els.view, params, query, restore });
    if (typeof out === "function") cleanup = out;
    window.scrollTo(0, restore ? scrollMap[cur.idx] || 0 : 0);
    return;
  }
  navigate("#/menu", { replace: true });
}

let saveTimer;
function onScroll() {
  scrollMap[cur.idx] = window.scrollY;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      sessionStorage.setItem("barapp.scroll", JSON.stringify(scrollMap));
    } catch {
      /* noop */
    }
  }, 300);
}

export function start(elements) {
  els = elements;
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  els.back.addEventListener("click", () => goBack(backTarget || "#/menu"));
  window.addEventListener("hashchange", onHashChange);
  window.addEventListener("scroll", onScroll, { passive: true });
  if (!location.hash || location.hash === "#") history.replaceState(history.state, "", "#/menu");
  onHashChange();
}
