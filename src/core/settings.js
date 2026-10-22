// Player settings and best results, kept in localStorage. Storage can be missing or throw (private windows, blocked
// site data), so every read and write is wrapped and the game runs on the defaults without it.
// Read once at boot; the title menu writes them (difficulty and quality apply from the next battle / reload).
const SKEY = 'vtk:settings', RKEY = 'vtk:records';
const read = (k) => { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch { return {}; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };

/** dmg: × damage the hero takes · hp: × officer / boss health · gap: × the time between enemy strikes. */
export const DIFFS = {
  easy: { id: 'easy', zh: '易', en: 'EASY', dmg: 0.55, hp: 0.75, gap: 1.3 },
  normal: { id: 'normal', zh: '普通', en: 'NORMAL', dmg: 1, hp: 1, gap: 1 },
  hard: { id: 'hard', zh: '難', en: 'HARD', dmg: 1.6, hp: 1.35, gap: 0.72 },
};

export const settings = { diff: 'normal', ...read(SKEY) };
if (!DIFFS[settings.diff]) settings.diff = 'normal';
export function saveSettings(patch) { Object.assign(settings, patch); write(SKEY, settings); }

// ---- best result per battle × hero: { rank, time, kos, combo, diff }
const RANKS = ['C', 'B', 'A', 'S'];
const records = read(RKEY);
export const bestOf = (stage, hero) => records[`${stage}:${hero}`] || null;
/** Keep r if it beats the stored best (higher rank, then the faster clear). Returns true for a new record. */
export function keepBest(stage, hero, r) {
  const k = `${stage}:${hero}`, b = records[k];
  const better = !b || RANKS.indexOf(r.rank) > RANKS.indexOf(b.rank) || (r.rank === b.rank && r.time < b.time);
  if (better) { records[k] = r; write(RKEY, records); }
  return better;
}

/** Rank from the clear: time against par (full marks at par, none at twice par), KOs against par, damage taken. */
export function rankOf({ time, kos, taken, hpMax }, par) {
  const c = (v) => Math.max(0, Math.min(1, v));
  const s = 0.4 * c((2 * par.time - time) / par.time) + 0.35 * c(kos / par.kos) + 0.25 * c(1 - taken / hpMax);
  return s >= 0.85 ? 'S' : s >= 0.7 ? 'A' : s >= 0.5 ? 'B' : 'C';
}
