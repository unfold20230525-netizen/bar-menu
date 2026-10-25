// メニュー：大ジャンル → 中ジャンル → ドリンク一覧
import { getCategories, findCategory, CATEGORY_EN } from "../data.js";
import * as store from "../store.js";
import { setChrome } from "../router.js";
import { esc, enc, formatPrice } from "../util.js";

const CHECK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;

const learnedCount = (drinks) => drinks.filter((d) => store.isLearned(d.id)).length;
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

export function emptyState(msg = "メニューを読み込んでいます…") {
  return `<section class="page"><div class="empty">
    <p>${esc(msg)}</p>
    <p class="muted small">右上の更新ボタンでデータを再取得できます。</p>
  </div></section>`;
}

export function listHref(cat) {
  return cat.subs.length === 1 ? `#/menu/${enc(cat.name)}/${enc(cat.subs[0].name)}` : `#/menu/${enc(cat.name)}`;
}

export function categoriesView({ view }) {
  setChrome({ title: "メニュー", tab: "menu" });
  const cats = getCategories();
  if (!cats.length) {
    view.innerHTML = emptyState();
    return;
  }
  view.innerHTML = `<section class="page">
    <header class="page-head">
      <p class="eyebrow">Drink Menu</p>
      <h2 class="page-title">メニュー</h2>
    </header>
    <ul class="cat-list">
      ${cats
        .map((c) => {
          const n = learnedCount(c.drinks);
          return `<li><a class="cat-card" href="${listHref(c)}">
            <span class="cat-en">${esc(CATEGORY_EN[c.name] || "")}</span>
            <span class="cat-name">${esc(c.name)}</span>
            <span class="cat-meta">${c.drinks.length}品<span class="dot">·</span>覚えた ${n}</span>
            <span class="mini-bar" aria-hidden="true"><i style="width:${pct(n, c.drinks.length)}%"></i></span>
          </a></li>`;
        })
        .join("")}
    </ul>
  </section>`;
}

export function subcategoriesView({ view, params: [catName] }) {
  const cat = findCategory(catName);
  setChrome({ title: catName, back: "#/menu", tab: "menu" });
  if (!cat) {
    view.innerHTML = emptyState("このジャンルは見つかりませんでした。");
    return;
  }
  view.innerHTML = `<section class="page">
    <header class="page-head">
      <p class="eyebrow">${esc(CATEGORY_EN[cat.name] || "Menu")}</p>
      <h2 class="page-title">${esc(cat.name)}</h2>
    </header>
    <ul class="row-list">
      ${cat.subs
        .map((s) => {
          const n = learnedCount(s.drinks);
          const done = n === s.drinks.length;
          return `<li><a class="row" href="#/menu/${enc(cat.name)}/${enc(s.name)}">
            <span class="row-main"><span class="row-title">${esc(s.name)}</span></span>
            <span class="row-side ${done ? "done" : ""}">${n} / ${s.drinks.length}</span>
            <span class="chev" aria-hidden="true"></span>
          </a></li>`;
        })
        .join("")}
    </ul>
  </section>`;
}

export function drinkRow(d, { showCat = false } = {}) {
  const learned = store.isLearned(d.id);
  const sub = showCat ? `${d.category}${d.subcategory ? " / " + d.subcategory : ""}` : d.short_name !== d.name ? d.short_name : "";
  return `<li><a class="row drink-row" href="#/drink/${enc(d.id)}">
    <span class="learned-mark ${learned ? "on" : ""}" aria-label="${learned ? "覚えた" : "未習得"}">${CHECK}</span>
    <span class="row-main">
      <span class="row-title">${esc(d.name)}</span>
      ${sub ? `<span class="row-sub">${esc(sub)}</span>` : ""}
    </span>
    <span class="row-side price">${esc(formatPrice(d.price))}</span>
  </a></li>`;
}

export function drinkListView({ view, params: [catName, subName] }) {
  const cat = findCategory(catName);
  const sub = cat && cat.subs.find((s) => s.name === subName);
  const back = cat && cat.subs.length > 1 ? `#/menu/${enc(catName)}` : "#/menu";
  setChrome({ title: subName, back, tab: "menu" });
  if (!sub) {
    view.innerHTML = emptyState("このジャンルは見つかりませんでした。");
    return;
  }
  const n = learnedCount(sub.drinks);
  view.innerHTML = `<section class="page">
    <header class="page-head">
      <p class="eyebrow">${esc(cat.name)}</p>
      <h2 class="page-title">${esc(sub.name)}</h2>
      <p class="page-note">${sub.drinks.length}品 ・ 覚えた ${n}</p>
    </header>
    <ul class="row-list">${sub.drinks.map((d) => drinkRow(d)).join("")}</ul>
  </section>`;
}
