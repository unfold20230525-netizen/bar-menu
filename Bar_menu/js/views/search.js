// 横断検索（商品名・略称・材料・ベース）
import { getDrinks } from "../data.js";
import { setChrome } from "../router.js";
import { esc, enc, normalize } from "../util.js";
import { drinkRow } from "./menu.js";

function match(d, q) {
  return [d.name, d.short_name, d.ingredients, d.base].some((v) => normalize(v).includes(q));
}

export function searchView({ view, query }) {
  setChrome({ title: "検索", back: "#/menu", tab: "menu" });
  const initial = query.get("q") || "";
  view.innerHTML = `<section class="page">
    <div class="search-box">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>
      <input type="search" id="q" placeholder="商品名・略称・材料で検索" value="${esc(initial)}" autocomplete="off" enterkeyhint="search" aria-label="検索キーワード">
    </div>
    <p class="page-note" id="count"></p>
    <ul class="row-list" id="results"></ul>
  </section>`;
  const input = view.querySelector("#q");
  const results = view.querySelector("#results");
  const count = view.querySelector("#count");

  const run = () => {
    const raw = input.value.trim();
    const q = normalize(raw);
    history.replaceState(history.state, "", "#/search" + (raw ? "?q=" + enc(raw) : ""));
    if (!q) {
      results.innerHTML = "";
      count.textContent = "例：「ジン」「カシス」「ライム」「マッカラン」";
      return;
    }
    const hits = getDrinks().filter((d) => match(d, q));
    count.textContent = hits.length ? `${hits.length}件` : "見つかりませんでした";
    results.innerHTML = hits.map((d) => drinkRow(d, { showCat: true })).join("");
  };
  input.addEventListener("input", run);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") input.blur();
  });
  run();
  if (!initial) setTimeout(() => input.focus(), 50);
}
