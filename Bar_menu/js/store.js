// 学習の進捗（覚えた・苦手・クイズ成績）を localStorage に保存
const KEY = "barapp.progress.v1";
const WEAK_CLEAR_STREAK = 3;

const empty = () => ({ version: 1, learned: {}, weak: {}, quiz: [], updatedAt: 0 });

function load() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || "null");
    return p && typeof p === "object" ? { ...empty(), ...p } : empty();
  } catch {
    return empty();
  }
}

let p = load();

function save() {
  p.updatedAt = Date.now();
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* プライベートモード等では保存できないが動作は続ける */
  }
}

export const isLearned = (id) => !!p.learned[id];
export function setLearned(id, val) {
  if (val) p.learned[id] = Date.now();
  else delete p.learned[id];
  save();
}
export const toggleLearned = (id) => setLearned(id, !isLearned(id));

export const isWeak = (id) => !!p.weak[id];
export const weakStreak = (id) => (p.weak[id] ? p.weak[id].streak : 0);
export const weakIds = () => Object.keys(p.weak).sort((a, b) => p.weak[b].since - p.weak[a].since);
export { WEAK_CLEAR_STREAK };

// クイズの回答結果を苦手リストに反映。苦手から外れたら true
export function recordAnswer(id, correct) {
  if (!correct) {
    p.weak[id] = { streak: 0, since: p.weak[id]?.since || Date.now() };
    save();
    return false;
  }
  if (p.weak[id]) {
    p.weak[id].streak += 1;
    if (p.weak[id].streak >= WEAK_CLEAR_STREAK) {
      delete p.weak[id];
      save();
      return true;
    }
    save();
  }
  return false;
}

export function addQuizResult(r) {
  p.quiz.unshift({ ...r, date: Date.now() });
  p.quiz = p.quiz.slice(0, 50);
  save();
}
export const quizHistory = () => p.quiz;

export function exportJSON() {
  return JSON.stringify({ app: "bar-menu-study", exportedAt: new Date().toISOString(), progress: p }, null, 2);
}

export function importJSON(text) {
  const obj = JSON.parse(text);
  const src = obj && obj.progress ? obj.progress : obj;
  if (!src || typeof src.learned !== "object" || typeof src.weak !== "object") {
    throw new Error("進捗ファイルの形式が正しくありません");
  }
  p = { ...empty(), learned: src.learned || {}, weak: src.weak || {}, quiz: Array.isArray(src.quiz) ? src.quiz : [] };
  save();
}

export function reset() {
  p = empty();
  save();
}
