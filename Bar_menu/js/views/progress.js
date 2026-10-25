// 進捗：カテゴリ別の覚えた率・苦手リスト・クイズ履歴・バックアップ
import { getCategories, getDrinks, getDrink, meta, sourceUrl } from "../data.js";
import * as store from "../store.js";
import { setChrome, rerender } from "../router.js";
import { esc, enc, toast, formatDate } from "../util.js";
import { startCards } from "./cards.js";
import { startQuizWeak, TYPES } from "./quiz.js";
import { emptyState } from "./menu.js";

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

function bar(label, n, total, cls = "") {
  return `<div class="progress-row ${cls}">
    <div class="progress-label"><span>${esc(label)}</span><span class="progress-num">${n} / ${total}<small>${pct(n, total)}%</small></span></div>
    <div class="progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${n}" aria-label="${esc(label)}"><i style="width:${pct(n, total)}%"></i></div>
  </div>`;
}

export function progressView({ view }) {
  setChrome({ title: "進捗", tab: "progress" });
  const cats = getCategories();
  if (!cats.length) {
    view.innerHTML = emptyState();
    return;
  }
  const all = getDrinks();
  const learned = (list) => list.filter((d) => store.isLearned(d.id)).length;
  const total = learned(all);
  const weak = store.weakIds().map(getDrink).filter(Boolean);
  const history = store.quizHistory();
  const recent = history.slice(0, 5);
  const agg = history.reduce((a, r) => ({ c: a.c + r.correct, t: a.t + r.total }), { c: 0, t: 0 });
  const m = meta();
  const typeLabel = (k) => (TYPES.find((t) => t.key === k) || {}).label || k;
  const isSheet = /^https?:/i.test(sourceUrl());

  view.innerHTML = `<section class="page">
    <header class="page-head">
      <p class="eyebrow">Progress</p>
      <h2 class="page-title">進捗</h2>
    </header>

    <div class="overall">
      <p class="overall-rate"><span>${pct(total, all.length)}</span>%</p>
      <p class="overall-sub">覚えた ${total} / ${all.length} 品</p>
      <div class="progress-bar big"><i style="width:${pct(total, all.length)}%"></i></div>
    </div>

    <section class="detail-section">
      <h3 class="section-title">カテゴリ別</h3>
      ${cats
        .map(
          (c) => `<details class="progress-cat">
        <summary>${bar(c.name, learned(c.drinks), c.drinks.length)}</summary>
        <div class="progress-subs">${c.subs.map((s) => bar(s.name, learned(s.drinks), s.drinks.length, "sub")).join("")}</div>
      </details>`
        )
        .join("")}
    </section>

    <section class="detail-section">
      <h3 class="section-title">苦手リスト <span class="count-pill">${weak.length}</span></h3>
      ${
        weak.length
          ? `<div class="btn-row">
          <button type="button" class="btn btn-primary" data-act="weak-cards">カードで復習</button>
          <button type="button" class="btn btn-ghost" data-act="weak-quiz">クイズで復習</button>
        </div>
        <ul class="row-list">${weak
          .map((d) => {
            const s = store.weakStreak(d.id);
            const dots = Array.from({ length: store.WEAK_CLEAR_STREAK }, (_, i) => `<i class="${i < s ? "on" : ""}"></i>`).join("");
            return `<li><a class="row" href="#/drink/${enc(d.id)}">
              <span class="row-main"><span class="row-title">${esc(d.name)}</span><span class="row-sub">${esc(d.category)} / ${esc(d.subcategory)}</span></span>
              <span class="streak" aria-label="連続正解 ${s} / ${store.WEAK_CLEAR_STREAK}">${dots}</span>
            </a></li>`;
          })
          .join("")}</ul>`
          : `<p class="muted small">苦手リストは空です。クイズで間違えたドリンクが自動で追加され、3回連続で正解すると外れます。</p>`
      }
    </section>

    <section class="detail-section">
      <h3 class="section-title">クイズの成績</h3>
      ${
        recent.length
          ? `<p class="muted small">通算正答率 ${pct(agg.c, agg.t)}%（${history.length}回）</p>
        <ul class="history">${recent
          .map(
            (r) => `<li><span class="history-date">${formatDate(r.date)}</span>
            <span class="history-type">${esc(typeLabel(r.type))}${r.cat ? ` <small>${esc(r.cat)}</small>` : ""}</span>
            <span class="history-score">${r.correct}/${r.total}</span></li>`
          )
          .join("")}</ul>`
          : `<p class="muted small">まだクイズの記録がありません。</p>`
      }
    </section>

    <section class="detail-section">
      <h3 class="section-title">メニューデータ</h3>
      <dl class="fields compact">
        <div class="field"><dt>読み込み元</dt><dd>${isSheet ? "Googleスプレッドシート" : "ローカルCSV（data/menu.csv）"}</dd></div>
        <div class="field"><dt>件数</dt><dd>${m.count}品</dd></div>
        <div class="field"><dt>最終更新</dt><dd>${m.fetchedAt ? formatDate(m.fetchedAt) : "—"}</dd></div>
      </dl>
      <button type="button" class="btn btn-ghost btn-block" data-act="refresh">データを更新</button>
    </section>

    <section class="detail-section">
      <h3 class="section-title">バックアップ</h3>
      <p class="muted small">機種変更の前に書き出し、新しいスマホで読み込むと進捗を引き継げます。</p>
      <div class="btn-row">
        <button type="button" class="btn btn-ghost" data-act="export">書き出し</button>
        <button type="button" class="btn btn-ghost" data-act="import">読み込み</button>
      </div>
      <input type="file" id="importFile" accept="application/json,.json" hidden>
      <button type="button" class="btn btn-danger btn-block" data-act="reset">進捗をリセット</button>
    </section>
  </section>`;

  const fileInput = view.querySelector("#importFile");

  async function doExport() {
    const json = store.exportJSON();
    const d = new Date();
    const name = `bar-progress-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}.json`;
    const file = new File([json], name, { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "BAR学習の進捗" });
        return;
      } catch (e) {
        if (e.name === "AbortError") return;
      }
    }
    const url = URL.createObjectURL(file);
    const a = Object.assign(document.createElement("a"), { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("進捗を書き出しました");
  }

  const onClick = async (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (!act) return;
    if (act === "weak-cards") startCards({ mode: "weak" });
    if (act === "weak-quiz") startQuizWeak();
    if (act === "refresh") document.getElementById("refreshBtn").click();
    if (act === "export") doExport();
    if (act === "import") fileInput.click();
    if (act === "reset" && confirm("覚えた・苦手リスト・クイズ成績をすべて消去します。よろしいですか？")) {
      store.reset();
      toast("進捗をリセットしました");
      rerender();
    }
  };
  const onFile = async () => {
    const f = fileInput.files[0];
    if (!f) return;
    try {
      const text = await f.text();
      if (!confirm("現在の進捗を、読み込んだファイルの内容で置き換えます。よろしいですか？")) return;
      store.importJSON(text);
      toast("進捗を読み込みました");
      rerender();
    } catch (err) {
      toast("読み込めませんでした：" + err.message, 4000);
    } finally {
      fileInput.value = "";
    }
  };
  view.addEventListener("click", onClick);
  fileInput.addEventListener("change", onFile);
  return () => view.removeEventListener("click", onClick);
}
