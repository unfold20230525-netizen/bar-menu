// メニューデータの取得・キャッシュ・整形
import { lines } from "./util.js";

const CACHE_KEY = "barapp.data.v1";
export const CATEGORY_ORDER = ["ビール", "カクテル", "ウイスキー", "ブランデー", "ノンアルコール"];
export const CATEGORY_EN = {
  ビール: "Beer", カクテル: "Cocktail", ウイスキー: "Whisky", ブランデー: "Brandy", ノンアルコール: "Non-Alcoholic",
};
const FLAVORS = ["sweet", "strength", "sour", "bitter", "smoky"];

const state = { drinks: [], byId: new Map(), categories: [], fetchedAt: 0, source: "" };
const listeners = new Set();

export const onChange = (fn) => listeners.add(fn);
export const getDrinks = () => state.drinks;
export const getDrink = (id) => state.byId.get(id);
export const getCategories = () => state.categories;
export const findCategory = (name) => state.categories.find((c) => c.name === name);
export const meta = () => ({ fetchedAt: state.fetchedAt, source: state.source, count: state.drinks.length });

export function sourceUrl() {
  return (window.APP_CONFIG && window.APP_CONFIG.CSV_URL || "").trim() || "data/menu.csv";
}

export function isSpiritCategory(d) {
  return d.category === "ウイスキー" || d.category === "ブランデー";
}

function parse(text) {
  const res = window.Papa.parse(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  const seen = new Set();
  const drinks = [];
  res.data.forEach((raw, i) => {
    const d = {};
    for (const [k, v] of Object.entries(raw)) d[k] = typeof v === "string" ? v.trim() : v;
    if (!d.id || !d.name || seen.has(d.id)) return;
    seen.add(d.id);
    d.category = d.category || "その他";
    d.subcategory = d.subcategory || "";
    for (const f of FLAVORS) {
      const n = parseInt(String(d[f] || "").normalize("NFKC"), 10);
      d[f] = n >= 1 && n <= 5 ? n : null;
    }
    d.verified = /^(true|1|yes|y|済|✓|〇|○)$/i.test(String(d.verified || ""));
    const s = parseFloat(d.sort);
    d.sort = isNaN(s) ? (i + 1) * 10 : s;
    d._i = i;
    d._ingredients = lines(d.ingredients);
    d._steps = lines(d.steps);
    drinks.push(d);
  });
  drinks.sort((a, b) => a.sort - b.sort || a._i - b._i);
  return drinks;
}

function buildCategories(drinks) {
  const map = new Map();
  for (const d of drinks) {
    if (!map.has(d.category)) map.set(d.category, { name: d.category, drinks: [], subs: new Map() });
    const c = map.get(d.category);
    c.drinks.push(d);
    const key = d.subcategory || "その他";
    if (!c.subs.has(key)) c.subs.set(key, { name: key, drinks: [] });
    c.subs.get(key).drinks.push(d);
  }
  const rank = (n) => {
    const i = CATEGORY_ORDER.indexOf(n);
    return i < 0 ? 99 : i;
  };
  return [...map.values()]
    .sort((a, b) => rank(a.name) - rank(b.name))
    .map((c) => ({ ...c, subs: [...c.subs.values()] }));
}

function apply(text, fetchedAt, source) {
  const drinks = parse(text);
  if (!drinks.length) throw new Error("データが0件でした");
  state.drinks = drinks;
  state.byId = new Map(drinks.map((d) => [d.id, d]));
  state.categories = buildCategories(drinks);
  state.fetchedAt = fetchedAt;
  state.source = source;
}

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
  } catch {
    return null;
  }
}

// キャッシュがあれば即座に使う。戻り値: キャッシュを使えたか
export function loadCached() {
  const c = readCache();
  if (!c || !c.text) return false;
  try {
    apply(c.text, c.fetchedAt, c.source);
    return true;
  } catch {
    return false;
  }
}

// 最新データを取得。変化があれば true
export async function refresh() {
  const url = sourceUrl();
  const sep = url.includes("?") ? "&" : "?";
  const res = await fetch(url + sep + "_=" + Date.now(), { cache: "no-store" });
  if (!res.ok) throw new Error("取得に失敗しました（" + res.status + "）");
  const text = await res.text();
  if (/^\s*<(!doctype|html)/i.test(text)) throw new Error("CSVではなくWebページが返されました。公開URLを確認してください");
  const prev = readCache();
  const now = Date.now();
  const changed = !prev || prev.text !== text || prev.source !== url;
  if (changed) apply(text, now, url);
  else state.fetchedAt = now;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ text, fetchedAt: now, source: url }));
  } catch {
    /* 容量超過などは無視（メモリ上のデータで動作） */
  }
  if (changed) listeners.forEach((fn) => fn());
  return changed;
}
