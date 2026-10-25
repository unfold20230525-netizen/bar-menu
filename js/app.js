// エントリーポイント：ルート定義・データ読み込み・Service Worker 登録
import * as data from "./data.js";
import { addRoute, start, rerender, currentPath } from "./router.js";
import { toast, imageUrl } from "./util.js";
import { categoriesView, subcategoriesView, drinkListView } from "./views/menu.js";
import { detailView } from "./views/detail.js";
import { searchView } from "./views/search.js";
import { cardsSetupView, cardsPlayView } from "./views/cards.js";
import { quizSetupView, quizPlayView, quizResultView } from "./views/quiz.js";
import { progressView } from "./views/progress.js";

addRoute(/^menu$/, categoriesView);
addRoute(/^menu\/([^/]+)$/, subcategoriesView);
addRoute(/^menu\/([^/]+)\/([^/]+)$/, drinkListView);
addRoute(/^drink\/([^/]+)$/, detailView);
addRoute(/^search$/, searchView);
addRoute(/^cards$/, cardsSetupView);
addRoute(/^cards\/play$/, cardsPlayView);
addRoute(/^quiz$/, quizSetupView);
addRoute(/^quiz\/play$/, quizPlayView);
addRoute(/^quiz\/result$/, quizResultView);
addRoute(/^progress$/, progressView);

// 学習セッション中は画面を差し替えない
const isSession = () => /^(cards|quiz)\/(play|result)$/.test(currentPath());

const refreshBtn = document.getElementById("refreshBtn");

async function refresh({ manual = false } = {}) {
  refreshBtn.classList.add("spinning");
  refreshBtn.disabled = true;
  try {
    const changed = await data.refresh();
    if (manual) toast(changed ? "最新のメニューに更新しました" : "メニューは最新です");
    else if (changed && isSession()) toast("メニューデータを更新しました");
  } catch (e) {
    if (manual || !data.getDrinks().length) toast((navigator.onLine ? "" : "オフラインのため") + "データを取得できませんでした" + (navigator.onLine ? "：" + e.message : ""), 4000);
  } finally {
    refreshBtn.classList.remove("spinning");
    refreshBtn.disabled = false;
  }
}

data.onChange(() => {
  if (!isSession()) rerender();
  precacheImages();
});

refreshBtn.addEventListener("click", () => refresh({ manual: true }));

// 画像をまとめて Service Worker にキャッシュさせ、オフラインでも表示できるようにする
function precacheImages() {
  const sw = navigator.serviceWorker && navigator.serviceWorker.controller;
  if (!sw) return;
  const urls = [...new Set(data.getDrinks().map(imageUrl).filter(Boolean))].map((u) => new URL(u, location.href).href);
  if (urls.length) sw.postMessage({ type: "precache-images", urls });
}

const hadCache = data.loadCached();
start({
  view: document.getElementById("view"),
  title: document.getElementById("appTitle"),
  back: document.getElementById("backBtn"),
  tabs: [...document.querySelectorAll(".tabbar a")],
});
refresh();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("sw.js")
    .then(() => navigator.serviceWorker.ready)
    .then(() => hadCache && precacheImages())
    .catch(() => {});
  navigator.serviceWorker.addEventListener("controllerchange", precacheImages);
}
