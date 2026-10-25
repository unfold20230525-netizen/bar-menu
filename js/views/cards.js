// フラッシュカード
import { getDrinks, getDrink, getCategories, isSpiritCategory } from "../data.js";
import * as store from "../store.js";
import { setChrome, navigate } from "../router.js";
import { esc, shuffle, onSwipe, reducedMotion } from "../util.js";
import { imageBox, preload } from "../placeholders.js";
import { flavorBars, field, ingredientsList, stepsList, priceText, serveText, unverifiedBadge } from "./parts.js";
import { emptyState } from "./menu.js";

const PREF_KEY = "barapp.cards.pref";
const MODES = [
  ["all", "すべて"],
  ["unlearned", "未習得のみ"],
  ["weak", "苦手のみ"],
];

let pref = { cat: "", sub: "", mode: "all" };
try {
  pref = { ...pref, ...JSON.parse(localStorage.getItem(PREF_KEY) || "{}") };
} catch {
  /* noop */
}
let session = null;

function savePref() {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(pref));
  } catch {
    /* noop */
  }
}

function pool(p) {
  return getDrinks().filter(
    (d) =>
      (!p.cat || d.category === p.cat) &&
      (!p.sub || d.subcategory === p.sub) &&
      (p.mode !== "unlearned" || !store.isLearned(d.id)) &&
      (p.mode !== "weak" || store.isWeak(d.id))
  );
}

function begin(ids) {
  session = { deck: shuffle(ids), i: 0, known: new Set(), unknown: new Set() };
  navigate("#/cards/play");
}

// 進捗画面などから直接開始する
export function startCards(p) {
  pref = { cat: "", sub: "", mode: "all", ...p };
  savePref();
  begin(pool(pref).map((d) => d.id));
}

const chip = (group, value, label, on) =>
  `<button type="button" class="chip ${on ? "on" : ""}" aria-pressed="${on}" data-group="${group}" data-value="${esc(value)}">${esc(label)}</button>`;

export function cardsSetupView({ view }) {
  setChrome({ title: "フラッシュカード", tab: "cards" });
  const cats = getCategories();
  if (!cats.length) {
    view.innerHTML = emptyState();
    return;
  }
  if (pref.cat && !cats.some((c) => c.name === pref.cat)) pref.cat = pref.sub = "";

  const draw = () => {
    const cat = cats.find((c) => c.name === pref.cat);
    if (cat && pref.sub && !cat.subs.some((s) => s.name === pref.sub)) pref.sub = "";
    const n = pool(pref).length;
    view.innerHTML = `<section class="page">
      <header class="page-head">
        <p class="eyebrow">Flash Cards</p>
        <h2 class="page-title">フラッシュカード</h2>
      </header>
      <div class="setup-group">
        <h3 class="group-title">カテゴリ</h3>
        <div class="chips">${chip("cat", "", "すべて", !pref.cat)}${cats.map((c) => chip("cat", c.name, c.name, pref.cat === c.name)).join("")}</div>
      </div>
      ${
        cat && cat.subs.length > 1
          ? `<div class="setup-group">
        <h3 class="group-title">ジャンル</h3>
        <div class="chips">${chip("sub", "", "すべて", !pref.sub)}${cat.subs.map((s) => chip("sub", s.name, s.name, pref.sub === s.name)).join("")}</div>
      </div>`
          : ""
      }
      <div class="setup-group">
        <h3 class="group-title">出題するカード</h3>
        <div class="seg">${MODES.map(([v, l]) => chip("mode", v, l, pref.mode === v)).join("")}</div>
      </div>
      <p class="setup-count">対象 <strong>${n}</strong> 枚<span class="dot">·</span>順番はシャッフル</p>
      <button type="button" class="btn btn-primary btn-block" data-act="start" ${n ? "" : "disabled"}>スタート</button>
      ${!n && pref.mode === "weak" ? `<p class="muted small center">苦手リストは空です。クイズで間違えたドリンクがここに入ります。</p>` : ""}
    </section>`;
  };
  draw();

  const onClick = (e) => {
    const c = e.target.closest(".chip");
    if (c) {
      const { group, value } = c.dataset;
      if (group === "cat") {
        pref.cat = value;
        pref.sub = "";
      } else pref[group] = value;
      savePref();
      draw();
      return;
    }
    if (e.target.closest("[data-act=start]")) begin(pool(pref).map((d) => d.id));
  };
  view.addEventListener("click", onClick);
  return () => view.removeEventListener("click", onClick);
}

function frontHtml(d) {
  return `<p class="fc-cat">${esc(d.category)}${d.subcategory ? " ・ " + esc(d.subcategory) : ""}</p>
    <h2 class="fc-name">${esc(d.name)}</h2>
    ${d.short_name && d.short_name !== d.name ? `<p class="fc-short"><span class="label">略称</span>${esc(d.short_name)}</p>` : ""}
    <p class="fc-tap">タップで裏返す</p>`;
}

function backHtml(d) {
  const body = isSpiritCategory(d)
    ? field("産地", d.region) + field("樽", d.cask) + field("香り", d.aroma) + field("味わい", d.taste) + field("余韻", d.finish) + field("おすすめの飲み方", serveText(d))
    : field("ベース", d.base) +
      field("技法", d.method) +
      field("グラス", d.glass) +
      ingredientsList(d) +
      stepsList(d, "作り方の要点") +
      field("ガーニッシュ", d.garnish) +
      field("味わい", d.taste) +
      field("香り", d.aroma) +
      field("飲み方", serveText(d));
  return `<p class="fc-back-name">${esc(d.name)} ${unverifiedBadge(d)}</p>
    <dl class="fields compact">${field("価格", priceText(d))}${body}</dl>
    ${flavorBars(d)}`;
}

export function cardsPlayView({ view }) {
  if (!session) {
    navigate("#/cards", { replace: true });
    return;
  }
  setChrome({ title: "フラッシュカード", back: "#/cards", tab: "cards", tabs: false });
  view.innerHTML = `<section class="cards-play">
    <div class="play-top">
      <span class="play-count" aria-live="polite"></span>
      <span class="play-bar" aria-hidden="true"><i></i></span>
    </div>
    <div class="fc-stage"></div>
    <div class="fc-actions">
      <button type="button" class="btn btn-ghost" data-act="no">まだ</button>
      <button type="button" class="btn btn-primary" data-act="yes">覚えた</button>
    </div>
    <p class="fc-hint">右スワイプ：覚えた ／ 左スワイプ：まだ</p>
  </section>`;
  const stage = view.querySelector(".fc-stage");
  const countEl = view.querySelector(".play-count");
  const barEl = view.querySelector(".play-bar i");
  const actions = view.querySelector(".fc-actions");
  const hint = view.querySelector(".fc-hint");
  let card = null;
  let busy = false;
  let stopSwipe = null;

  const current = () => getDrink(session.deck[session.i]);

  function updateTop() {
    const total = session.deck.length;
    const shown = Math.min(session.i + 1, total);
    countEl.innerHTML = `<b>${shown}</b> / ${total}`;
    barEl.style.width = `${(session.i / total) * 100}%`;
  }

  function flip() {
    const t = card && card.querySelector(".fc-text");
    if (!t) return;
    const inner = t.querySelector(".fc-inner");
    if (reducedMotion()) {
      t.classList.toggle("flipped");
    } else if (t.classList.contains("flipped")) {
      // 平面表示（settled）から3Dの裏返し状態に戻してから、表へ回転させる
      t.classList.add("no-anim");
      t.classList.remove("settled");
      void t.offsetWidth;
      t.classList.remove("no-anim");
      t.classList.remove("flipped");
    } else {
      t.classList.add("flipped");
      inner.addEventListener(
        "transitionend",
        () => {
          if (t.classList.contains("flipped")) t.classList.add("settled");
        },
        { once: true }
      );
    }
    const back = t.classList.contains("flipped");
    t.setAttribute("aria-label", back ? "表に戻す" : "カードを裏返す");
    t.querySelector(".fc-front").setAttribute("aria-hidden", String(back));
    t.querySelector(".fc-back").setAttribute("aria-hidden", String(!back));
  }

  function renderCard() {
    stopSwipe?.();
    stopSwipe = null;
    while (session.i < session.deck.length && !current()) session.i++; // データ更新で消えたカードは飛ばす
    if (session.i >= session.deck.length) return renderDone();
    const d = current();
    updateTop();
    stage.innerHTML = `<div class="fc">
      <div class="fc-img">${imageBox(d)}</div>
      <div class="fc-text" role="button" tabindex="0" aria-label="カードを裏返す">
        <div class="fc-inner">
          <div class="fc-face fc-front">${frontHtml(d)}</div>
          <div class="fc-face fc-back" aria-hidden="true"><div class="fc-scroll">${backHtml(d)}</div></div>
        </div>
      </div>
      <span class="fc-stamp yes" aria-hidden="true">覚えた</span>
      <span class="fc-stamp no" aria-hidden="true">まだ</span>
    </div>`;
    card = stage.firstElementChild;
    // 事前読み込み済みの画像はフェードさせずに即表示（ちらつき防止）
    const img = card.querySelector(".img-box img");
    if (img && img.complete && img.naturalWidth) img.classList.add("loaded", "instant");
    preload(getDrink(session.deck[session.i + 1]));
    preload(getDrink(session.deck[session.i + 2]));

    const stampYes = card.querySelector(".fc-stamp.yes");
    const stampNo = card.querySelector(".fc-stamp.no");
    stopSwipe = onSwipe(card, {
      onMove: (dx) => {
        if (busy) return;
        card.style.transition = "none";
        card.style.transform = reducedMotion() ? "" : `translateX(${dx}px) rotate(${dx / 24}deg)`;
        stampYes.style.opacity = Math.max(0, Math.min(1, dx / 90));
        stampNo.style.opacity = Math.max(0, Math.min(1, -dx / 90));
      },
      onEnd: (dir) => {
        if (busy) return;
        if (dir) return mark(dir > 0);
        card.style.transition = "";
        card.style.transform = "";
        stampYes.style.opacity = stampNo.style.opacity = "";
      },
    });
  }

  function mark(known) {
    if (busy || !card) return;
    const d = current();
    busy = true;
    store.setLearned(d.id, known);
    session.known.delete(d.id);
    session.unknown.delete(d.id);
    (known ? session.known : session.unknown).add(d.id);
    card.style.transition = "";
    card.style.transform = "";
    card.classList.add(reducedMotion() ? "fade-out" : known ? "fly-right" : "fly-left");
    card.querySelector(`.fc-stamp.${known ? "yes" : "no"}`).style.opacity = 1;
    setTimeout(() => {
      session.i++;
      busy = false;
      renderCard();
    }, reducedMotion() ? 180 : 280);
  }

  function renderDone() {
    card = null;
    actions.hidden = true;
    hint.hidden = true;
    countEl.innerHTML = `<b>${session.deck.length}</b> / ${session.deck.length}`;
    barEl.style.width = "100%";
    const k = session.known.size;
    const u = session.unknown.size;
    stage.innerHTML = `<div class="done">
      <p class="eyebrow">Complete</p>
      <h2 class="done-title">おつかれさまでした</h2>
      <div class="done-stats">
        <div><span class="done-num">${k}</span><span class="done-label">覚えた</span></div>
        <div><span class="done-num">${u}</span><span class="done-label">まだ</span></div>
      </div>
      <div class="done-actions">
        ${u ? `<button type="button" class="btn btn-primary btn-block" data-act="retry">「まだ」の ${u} 枚をもう一度</button>` : ""}
        <button type="button" class="btn ${u ? "btn-ghost" : "btn-primary"} btn-block" data-act="again">もう一度シャッフル</button>
        <button type="button" class="btn btn-text btn-block" data-act="setup">設定に戻る</button>
      </div>
    </div>`;
  }

  const onClick = (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "yes") return mark(true);
    if (act === "no") return mark(false);
    if (act === "retry" || act === "again") {
      const ids = act === "retry" ? [...session.unknown] : session.deck;
      session = { deck: shuffle(ids), i: 0, known: new Set(), unknown: new Set() };
      actions.hidden = hint.hidden = false;
      return renderCard();
    }
    if (act === "setup") return navigate("#/cards", { replace: true });
    if (e.target.closest(".fc-text") && !card?.dataset.swiped) flip();
  };
  const onKey = (e) => {
    if (!card || e.target.matches("input, textarea")) return;
    if (e.key === "ArrowRight") mark(true);
    else if (e.key === "ArrowLeft") mark(false);
    else if (e.key === " " || e.key === "Enter") {
      if (document.activeElement?.matches("button, a")) return;
      e.preventDefault();
      flip();
    }
  };
  view.addEventListener("click", onClick);
  document.addEventListener("keydown", onKey);
  renderCard();

  return () => {
    stopSwipe?.();
    view.removeEventListener("click", onClick);
    document.removeEventListener("keydown", onKey);
  };
}
