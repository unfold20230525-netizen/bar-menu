// 詳細画面とフラッシュカードで共通の表示パーツ
import { esc, formatPrice, formatServe } from "../util.js";

export const FLAVOR_LABELS = [
  ["sweet", "甘さ"],
  ["strength", "強さ"],
  ["sour", "酸味"],
  ["bitter", "苦味"],
  ["smoky", "スモーキー"],
];

export function flavorBars(d) {
  const rows = FLAVOR_LABELS.filter(([k]) => d[k]);
  if (!rows.length) return "";
  return `<div class="flavors">${rows
    .map(
      ([k, label]) => `<div class="flavor" role="img" aria-label="${label} ${d[k]} / 5">
        <span class="flavor-label">${label}</span>
        <span class="flavor-bar">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= d[k] ? "on" : ""}"></i>`).join("")}</span>
      </div>`
    )
    .join("")}</div>`;
}

// 空欄は出さない
export function field(label, value, { multiline = false } = {}) {
  if (!value) return "";
  const body = multiline ? esc(value).replace(/\n/g, "<br>") : esc(value);
  return `<div class="field"><dt>${esc(label)}</dt><dd>${body}</dd></div>`;
}

export function ingredientsList(d) {
  if (!d._ingredients.length) return "";
  return `<div class="field field-block"><dt>材料と分量</dt><dd><ul class="ingredients">${d._ingredients
    .map((l) => {
      const m = l.match(/^(.*\S)\s+(\S+)$/);
      return m && /^(約|適量|少量|少々|お好み|[0-9０-９½¼¾]|1\/)/.test(m[2])
        ? `<li><span>${esc(m[1])}</span><span class="amount">${esc(m[2])}</span></li>`
        : `<li><span>${esc(l)}</span></li>`;
    })
    .join("")}</ul></dd></div>`;
}

export function stepsList(d, label = "作り方") {
  if (!d._steps.length) return "";
  return `<div class="field field-block"><dt>${esc(label)}</dt><dd><ol class="steps">${d._steps
    .map((s) => `<li>${esc(s)}</li>`)
    .join("")}</ol></dd></div>`;
}

export const priceText = (d) => formatPrice(d.price);
export const serveText = (d) => formatServe(d.serve);

export function unverifiedBadge(d) {
  return d.verified ? "" : `<span class="badge-unverified" title="AIの下書きのまま。店のレシピで確認してください">未確認</span>`;
}
