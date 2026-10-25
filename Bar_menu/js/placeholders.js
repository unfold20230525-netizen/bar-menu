// 画像がないときのカテゴリ別プレースホルダー（ゴールドの線画）
import { esc, imageUrl } from "./util.js";
import { CATEGORY_EN } from "./data.js";

const G = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';

const ART = {
  ビール: `<path d="M52 62h50v92a8 8 0 0 1-8 8H60a8 8 0 0 1-8-8z"/><path d="M102 78h12a10 10 0 0 1 10 10v28a10 10 0 0 1-10 10h-12"/>
    <path d="M50 62c-6-10 2-22 14-18 4-10 20-12 26-2 10-4 20 4 16 16"/><path d="M66 84v62M80 84v62M94 84v62" opacity=".45"/>`,
  カクテル: `<path d="M38 52h84L80 104z"/><path d="M80 104v52"/><path d="M58 162h44"/><path d="M50 64h60" opacity=".45"/>
    <circle cx="92" cy="70" r="6"/><path d="M98 64l18-22"/>`,
  ウイスキー: `<path d="M46 74h68l-6 84H52z"/><path d="M48 98h64" opacity=".45"/><rect x="58" y="104" width="20" height="20" rx="3" transform="rotate(-8 68 114)"/>
    <rect x="80" y="110" width="20" height="20" rx="3" transform="rotate(10 90 120)"/><path d="M52 158h56" />`,
  ブランデー: `<path d="M52 60c-14 30-10 66 28 70 38-4 42-40 28-70z"/><path d="M80 130v24"/><path d="M60 158h40"/><path d="M50 104c18 8 42 8 60 0" opacity=".45"/>`,
  ノンアルコール: `<path d="M54 56h52l-6 104H60z"/><path d="M86 56l14-34h12"/><circle cx="66" cy="54" r="14"/><path d="M66 40v28M52 54h28M56 44l20 20M76 44L56 64" opacity=".45"/>
    <path d="M57 96h46" opacity=".45"/>`,
};

export function placeholderSvg(category) {
  const art = ART[category] || ART["カクテル"];
  const label = CATEGORY_EN[category] || category || "";
  return `<svg class="ph-art" viewBox="0 0 160 200" aria-hidden="true">
    <g ${G}>${art}</g>
    <text x="80" y="188" text-anchor="middle">${esc(label)}</text>
  </svg>`;
}

// 画像エリア。読み込みに失敗したら img を外してプレースホルダーを見せる
export function imageBox(d, cls = "") {
  const url = imageUrl(d);
  const img = url
    ? `<img src="${esc(url)}" alt="${esc(d.name)}" decoding="async" onload="this.classList.add('loaded')" onerror="this.remove()">`
    : "";
  return `<div class="img-box ${cls}"><div class="ph">${placeholderSvg(d.category)}</div>${img}</div>`;
}

// 画像の事前読み込み（URLごとに1回）
const preloaded = new Map();
export function preload(d) {
  const url = d && imageUrl(d);
  if (!url || preloaded.has(url)) return;
  const im = new Image();
  im.decoding = "async";
  im.src = url;
  preloaded.set(url, im);
}
