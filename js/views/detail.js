// ドリンク詳細
import { getDrink, findCategory, isSpiritCategory } from "../data.js";
import * as store from "../store.js";
import { setChrome, navigate } from "../router.js";
import { esc, enc, onSwipe, reducedMotion } from "../util.js";
import { imageBox, preload } from "../placeholders.js";
import { emptyState } from "./menu.js";
import { flavorBars, field, ingredientsList, stepsList, priceText, serveText, unverifiedBadge } from "./parts.js";

let lastDir = 0; // スワイプ方向（入場アニメーション用）

function siblings(d) {
  const cat = findCategory(d.category);
  const sub = cat && cat.subs.find((s) => s.name === (d.subcategory || "その他"));
  return sub ? sub.drinks : [d];
}

function learnButton(d) {
  const on = store.isLearned(d.id);
  return `<button type="button" class="btn learn-toggle ${on ? "on" : ""}" aria-pressed="${on}" data-act="learn">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
    <span>${on ? "覚えた" : "覚えたらタップ"}</span>
  </button>`;
}

function section(title, inner) {
  return inner.trim() ? `<section class="detail-section"><h3 class="section-title">${esc(title)}</h3><dl class="fields">${inner}</dl></section>` : "";
}

export function detailView({ view, params: [id] }) {
  const d = getDrink(id);
  if (!d) {
    setChrome({ title: "ドリンク", back: "#/menu", tab: "menu" });
    view.innerHTML = emptyState("このドリンクは見つかりませんでした。");
    return;
  }
  const list = siblings(d);
  const i = list.indexOf(d);
  const prev = list[i - 1];
  const next = list[i + 1];
  const cat = findCategory(d.category);
  const back = cat ? `#/menu/${enc(d.category)}/${enc(d.subcategory || "その他")}` : "#/menu";
  setChrome({ title: d.subcategory || d.category, back, tab: "menu" });

  const spirit = isSpiritCategory(d);
  const facts = [
    ["価格", priceText(d)],
    ["ベース", d.base],
    ["度数", d.abv],
  ].filter(([, v]) => v);

  const notes =
    (d.talk ? `<div class="note note-talk"><p class="note-label">接客トーク</p><p>${esc(d.talk)}</p></div>` : "") +
    (d.staff_note ? `<div class="note note-staff"><p class="note-label">スタッフメモ</p><p>${esc(d.staff_note)}</p></div>` : "") +
    (d.my_note ? `<div class="note note-mine"><p class="note-label">自分用メモ</p><p>${esc(d.my_note).replace(/\n/g, "<br>")}</p></div>` : "");

  const recipe = section(
    "レシピ",
    field("技法", d.method) + field("グラス", d.glass) + ingredientsList(d) + stepsList(d) + field("ガーニッシュ", d.garnish)
  );
  const profile = section(
    "プロフィール",
    field("産地", d.region) + field("蒸溜所", d.distillery) + field("熟成年数", d.age) + field("樽", d.cask) + field("おすすめの飲み方", serveText(d))
  );
  const tasting = section(
    "テイスティング",
    spirit
      ? field("香り", d.aroma) + field("味わい", d.taste) + field("余韻", d.finish)
      : field("味わい", d.taste) + field("香り", d.aroma) + field("余韻", d.finish)
  );
  const flavor = flavorBars(d);

  view.innerHTML = `<article class="page detail ${lastDir > 0 ? "enter-left" : lastDir < 0 ? "enter-right" : ""}">
    ${imageBox(d, "detail-img")}
    <header class="detail-head">
      <p class="eyebrow">${esc(d.category)}${d.subcategory ? " ・ " + esc(d.subcategory) : ""}</p>
      <h2 class="detail-name">${esc(d.name)}</h2>
      <p class="detail-short">${d.short_name ? `<span class="label">略称</span>${esc(d.short_name)}` : ""}${unverifiedBadge(d)}</p>
    </header>
    ${facts.length ? `<dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` : ""}
    ${learnButton(d)}
    ${flavor ? `<section class="detail-section"><h3 class="section-title">味わいのバランス</h3>${flavor}</section>` : ""}
    ${notes ? `<section class="detail-section notes">${notes}</section>` : ""}
    ${spirit ? profile + tasting : recipe + tasting + profile}
    <nav class="pager" aria-label="前後のドリンク">
      ${prev ? `<a class="pager-btn" href="#/drink/${enc(prev.id)}" data-replace><span aria-hidden="true">‹</span> ${esc(prev.name)}</a>` : "<span></span>"}
      <span class="pager-pos">${i + 1} / ${list.length}</span>
      ${next ? `<a class="pager-btn next" href="#/drink/${enc(next.id)}" data-replace>${esc(next.name)} <span aria-hidden="true">›</span></a>` : "<span></span>"}
    </nav>
  </article>`;
  lastDir = 0;

  preload(prev);
  preload(next);

  const article = view.querySelector(".detail");
  const go = (target, dir) => {
    if (!target) return;
    lastDir = dir;
    navigate(`#/drink/${enc(target.id)}`, { replace: true });
  };

  const onClick = (e) => {
    if (article.dataset.swiped) {
      e.preventDefault();
      return;
    }
    const btn = e.target.closest("[data-act=learn]");
    if (btn) {
      store.toggleLearned(d.id);
      btn.outerHTML = learnButton(d);
      return;
    }
    const a = e.target.closest("a[data-replace]");
    if (a) {
      e.preventDefault();
      const isNext = a.classList.contains("next");
      go(isNext ? next : prev, isNext ? 1 : -1);
    }
  };
  view.addEventListener("click", onClick);

  const stopSwipe = onSwipe(article, {
    onMove: (dx) => {
      if (reducedMotion()) return;
      const edge = (dx > 0 && !prev) || (dx < 0 && !next);
      article.style.transform = `translateX(${edge ? dx / 4 : dx / 2}px)`;
    },
    onEnd: (dir) => {
      article.style.transform = "";
      if (dir < 0) go(next, 1);
      else if (dir > 0) go(prev, -1);
    },
  });

  return () => {
    view.removeEventListener("click", onClick);
    stopSwipe();
  };
}
