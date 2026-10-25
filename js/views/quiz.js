// 4択クイズ
import { getDrinks, getDrink, getCategories } from "../data.js";
import * as store from "../store.js";
import { setChrome, navigate } from "../router.js";
import { esc, enc, shuffle, normalize, ingredientName, priceNumber, formatPrice } from "../util.js";
import { emptyState } from "./menu.js";

const QUESTIONS = 10;
const PREF_KEY = "barapp.quiz.pref";
const METHODS = ["ビルド", "シェイク", "ステア", "ブレンド"];

export const TYPES = [
  {
    key: "short", label: "略称 → 正式名称", lead: "この略称の正式名称は？", drinkAnswer: true,
    ok: (d) => d.short_name && normalize(d.short_name) !== normalize(d.name),
    q: (d) => d.short_name, a: (d) => d.name,
  },
  {
    key: "base", label: "商品名 → ベース", lead: "ベースのお酒は？",
    ok: (d) => !!d.base, q: (d) => d.name, a: (d) => d.base,
  },
  {
    key: "ingredients", label: "材料 → 商品名", lead: "この材料で作るのは？", drinkAnswer: true,
    ok: (d) => d._ingredients.length >= 2,
    q: (d) => d._ingredients.map(ingredientName).join(" ＋ "), a: (d) => d.name,
  },
  {
    key: "method", label: "商品名 → 技法・グラス", lead: "技法とグラスは？",
    ok: (d) => d.method && d.glass, q: (d) => d.name, a: (d) => `${d.method} ／ ${d.glass}`,
  },
  {
    key: "price", label: "商品名 → 価格", lead: "価格は？",
    ok: (d) => priceNumber(d.price) != null, q: (d) => d.name, a: (d) => formatPrice(d.price),
  },
  {
    key: "region", label: "ウイスキー → 産地", lead: "産地は？",
    ok: (d) => d.category === "ウイスキー" && !!d.region, q: (d) => d.name, a: (d) => d.region,
  },
];
const typeOf = (key) => TYPES.find((t) => t.key === key) || TYPES[0];

let pref = { cat: "", type: "short", weakOnly: false };
try {
  pref = { ...pref, ...JSON.parse(localStorage.getItem(PREF_KEY) || "{}") };
} catch {
  /* noop */
}
let session = null;
let lastResult = null;

function savePref() {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(pref));
  } catch {
    /* noop */
  }
}

function eligible(p, type) {
  return getDrinks().filter((d) => type.ok(d) && (!p.cat || d.category === p.cat) && (!p.weakOnly || store.isWeak(d.id)));
}

function pickFrom(tiers, n, ans) {
  const out = [];
  const seen = new Set([ans]);
  for (const tier of tiers) {
    for (const v of shuffle(tier)) {
      if (out.length >= n) return out;
      if (!seen.has(v)) {
        seen.add(v);
        out.push(v);
      }
    }
  }
  return out;
}

// 紛らわしい誤答を選ぶ：同じ中ジャンル → 同じ大ジャンル → その他 の順に優先
function distractors(type, d) {
  const all = getDrinks();
  const ans = type.a(d);
  const qd = type.q(d);
  const pool = all.filter((x) => x.id !== d.id && type.ok(x) && type.a(x) !== ans && !(type.drinkAnswer && type.q(x) === qd));
  const sameCat = pool.filter((x) => x.category === d.category);

  if (type.key === "price") {
    const n = priceNumber(d.price);
    const near = [...new Set(sameCat.map((x) => priceNumber(x.price)))].sort((a, b) => Math.abs(a - n) - Math.abs(b - n)).slice(0, 5);
    const synth = [100, -100, 200, -200, 300, 500].map((k) => n + k).filter((v) => v > 0);
    return pickFrom([near, synth], 3, n).map((v) => formatPrice(v));
  }
  if (type.key === "method") {
    const ms = [...new Set([d.method, ...sameCat.map((x) => x.method), ...METHODS])];
    const gs = [...new Set([d.glass, ...sameCat.map((x) => x.glass)])];
    const combos = ms.flatMap((m) => gs.map((g) => ({ m, g })));
    const label = (c) => `${c.m} ／ ${c.g}`;
    const oneSame = combos.filter((c) => (c.m === d.method) !== (c.g === d.glass)).map(label);
    return pickFrom([oneSame, combos.map(label)], 3, ans);
  }
  if (type.key === "region") {
    const country = (r) => r.split(/[／/]/)[0];
    const same = pool.filter((x) => country(x.region) === country(d.region)).map(type.a);
    return pickFrom([same, pool.map(type.a)], 3, ans);
  }
  const tiers = [
    sameCat.filter((x) => x.subcategory === d.subcategory),
    sameCat.filter((x) => x.subcategory !== d.subcategory),
    pool.filter((x) => x.category !== d.category),
  ].map((t) => t.map(type.a));
  return pickFrom(tiers, 3, ans);
}

function buildSession(p) {
  const type = typeOf(p.type);
  const qs = [];
  for (const d of shuffle(eligible(p, type))) {
    if (qs.length >= QUESTIONS) break;
    const wrong = distractors(type, d);
    if (wrong.length < 3) continue;
    qs.push({ id: d.id, prompt: type.q(d), answer: type.a(d), choices: shuffle([type.a(d), ...wrong]), chosen: null });
  }
  return { type: type.key, cat: p.cat, weakOnly: p.weakOnly, qs, i: 0 };
}

function begin() {
  session = buildSession(pref);
  if (!session.qs.length) return;
  navigate("#/quiz/play");
}

export function startQuizWeak() {
  pref.weakOnly = true;
  savePref();
  navigate("#/quiz");
}

const chip = (group, value, label, on, disabled = false) =>
  `<button type="button" class="chip ${on ? "on" : ""}" aria-pressed="${on}" data-group="${group}" data-value="${esc(value)}" ${disabled ? "disabled" : ""}>${esc(label)}</button>`;

export function quizSetupView({ view }) {
  setChrome({ title: "クイズ", tab: "quiz" });
  const cats = getCategories();
  if (!cats.length) {
    view.innerHTML = emptyState();
    return;
  }
  if (pref.cat && !cats.some((c) => c.name === pref.cat)) pref.cat = "";

  const draw = () => {
    const counts = Object.fromEntries(TYPES.map((t) => [t.key, eligible(pref, t).length]));
    const available = (k) => counts[k] >= 4;
    if (!available(pref.type)) pref.type = (TYPES.find((t) => available(t.key)) || typeOf(pref.type)).key;
    const n = Math.min(QUESTIONS, counts[pref.type]);
    view.innerHTML = `<section class="page">
      <header class="page-head">
        <p class="eyebrow">Quiz</p>
        <h2 class="page-title">クイズ</h2>
      </header>
      <div class="setup-group">
        <h3 class="group-title">カテゴリ</h3>
        <div class="chips">${chip("cat", "", "すべて", !pref.cat)}${cats.map((c) => chip("cat", c.name, c.name, pref.cat === c.name)).join("")}</div>
      </div>
      <div class="setup-group">
        <h3 class="group-title">出題タイプ</h3>
        <div class="type-list">${TYPES.map(
          (t) => `<button type="button" class="type-item ${pref.type === t.key ? "on" : ""}" data-group="type" data-value="${t.key}" aria-pressed="${pref.type === t.key}" ${available(t.key) ? "" : "disabled"}>
            <span>${esc(t.label)}</span><span class="type-count">${available(t.key) ? counts[t.key] + "品" : "対象なし"}</span>
          </button>`
        ).join("")}</div>
      </div>
      <div class="setup-group">
        <button type="button" class="toggle ${pref.weakOnly ? "on" : ""}" data-group="weak" aria-pressed="${pref.weakOnly}">
          <span class="toggle-knob" aria-hidden="true"></span>苦手リストのドリンクだけ出題
        </button>
      </div>
      <p class="setup-count">${available(pref.type) ? `<strong>${n}</strong> 問<span class="dot">·</span>4択` : "この条件では出題できません"}</p>
      <button type="button" class="btn btn-primary btn-block" data-act="start" ${available(pref.type) ? "" : "disabled"}>スタート</button>
    </section>`;
  };
  draw();

  const onClick = (e) => {
    const el = e.target.closest("[data-group]");
    if (el) {
      const { group, value } = el.dataset;
      if (group === "cat") pref.cat = value;
      if (group === "type") pref.type = value;
      if (group === "weak") pref.weakOnly = !pref.weakOnly;
      savePref();
      draw();
      return;
    }
    if (e.target.closest("[data-act=start]")) begin();
  };
  view.addEventListener("click", onClick);
  return () => view.removeEventListener("click", onClick);
}

export function quizPlayView({ view }) {
  if (!session || !session.qs.length) {
    navigate("#/quiz", { replace: true });
    return;
  }
  const type = typeOf(session.type);
  setChrome({ title: "クイズ", back: "#/quiz", tab: "quiz", tabs: false });

  const draw = () => {
    const q = session.qs[session.i];
    const total = session.qs.length;
    view.innerHTML = `<section class="quiz-play">
      <div class="play-top">
        <span class="play-count"><b>${session.i + 1}</b> / ${total}</span>
        <span class="play-bar" aria-hidden="true"><i style="width:${(session.i / total) * 100}%"></i></span>
      </div>
      <div class="q-card">
        <p class="q-lead">${esc(type.label)}</p>
        <p class="q-main ${q.prompt.length > 18 ? "long" : ""}">${esc(q.prompt)}</p>
        <p class="q-ask">${esc(type.lead)}</p>
      </div>
      <div class="choices">${q.choices.map((c, i) => `<button type="button" class="choice" data-i="${i}">${esc(c)}</button>`).join("")}</div>
      <p class="q-feedback" aria-live="polite"></p>
      <button type="button" class="btn btn-primary btn-block q-next" hidden>${session.i + 1 < total ? "次へ" : "結果を見る"}</button>
    </section>`;
  };

  const answer = (btn) => {
    const q = session.qs[session.i];
    if (q.chosen != null) return;
    q.chosen = q.choices[Number(btn.dataset.i)];
    const correct = q.chosen === q.answer;
    const cleared = store.recordAnswer(q.id, correct);
    view.querySelectorAll(".choice").forEach((b) => {
      b.disabled = true;
      if (q.choices[Number(b.dataset.i)] === q.answer) b.classList.add(correct ? "correct" : "reveal");
    });
    if (!correct) btn.classList.add("wrong");
    const fb = view.querySelector(".q-feedback");
    fb.className = "q-feedback " + (correct ? "ok" : "ng");
    fb.textContent = correct ? (cleared ? "正解！ 苦手リストから外れました" : "正解！") : `不正解 … 正解は「${q.answer}」`;
    const next = view.querySelector(".q-next");
    next.hidden = false;
    next.focus({ preventScroll: true });
  };

  const finish = () => {
    const wrong = session.qs.filter((q) => q.chosen !== q.answer);
    const correct = session.qs.length - wrong.length;
    lastResult = { ...session, correct, total: session.qs.length, wrong };
    store.addQuizResult({ type: session.type, cat: session.cat, correct, total: session.qs.length });
    navigate("#/quiz/result", { replace: true });
  };

  const onClick = (e) => {
    const c = e.target.closest(".choice");
    if (c) return answer(c);
    if (e.target.closest(".q-next")) {
      if (session.i + 1 < session.qs.length) {
        session.i++;
        draw();
        window.scrollTo(0, 0);
      } else finish();
    }
  };
  view.addEventListener("click", onClick);
  draw();
  return () => view.removeEventListener("click", onClick);
}

export function quizResultView({ view }) {
  if (!lastResult) {
    navigate("#/quiz", { replace: true });
    return;
  }
  const r = lastResult;
  const type = typeOf(r.type);
  const rate = Math.round((r.correct / r.total) * 100);
  const msg = rate === 100 ? "パーフェクト！" : rate >= 80 ? "よくできました" : rate >= 50 ? "あと少し" : "復習してもう一度";
  setChrome({ title: "クイズ結果", back: "#/quiz", tab: "quiz" });
  view.innerHTML = `<section class="page">
    <div class="result-hero">
      <p class="eyebrow">${esc(type.label)}${r.cat ? " ・ " + esc(r.cat) : ""}</p>
      <p class="result-rate"><span>${rate}</span>%</p>
      <p class="result-score">${r.correct} / ${r.total} 問正解</p>
      <p class="result-msg">${msg}</p>
    </div>
    ${
      r.wrong.length
        ? `<section class="detail-section">
      <h3 class="section-title">間違えたドリンク</h3>
      <p class="muted small">苦手リストに追加しました（3回連続で正解すると外れます）</p>
      <ul class="row-list">${r.wrong
        .map((q) => {
          const d = getDrink(q.id);
          return d
            ? `<li><a class="row" href="#/drink/${enc(d.id)}"><span class="row-main">
              <span class="row-title">${esc(d.name)}</span>
              <span class="row-sub">正解：${esc(q.answer)}<br>あなたの答え：${esc(q.chosen)}</span>
            </span><span class="chev" aria-hidden="true"></span></a></li>`
            : "";
        })
        .join("")}</ul>
    </section>`
        : ""
    }
    <div class="stack">
      <button type="button" class="btn btn-primary btn-block" data-act="again">もう一度（同じ設定）</button>
      <a class="btn btn-ghost btn-block" href="#/quiz">設定に戻る</a>
    </div>
  </section>`;
  const onClick = (e) => {
    if (e.target.closest("[data-act=again]")) {
      session = buildSession({ cat: r.cat, type: r.type, weakOnly: r.weakOnly });
      if (session.qs.length) navigate("#/quiz/play", { replace: true });
      else navigate("#/quiz", { replace: true });
    }
  };
  view.addEventListener("click", onClick);
  return () => view.removeEventListener("click", onClick);
}
