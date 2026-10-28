/* Weekly challenge: one text per language for everyone during an ISO week.
 * The text is chosen deterministically from the week key, so every browser
 * types the same one without asking the server.
 */

import { TEXTS } from './texts.js';

/** ISO-8601 week key ('2026-W44') in UTC — must match weekKey() in src/services/challenge.js. */
export function weekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Session mode the week's runs are saved under (the server ranks by it). */
export function weeklyMode(lang, week = weekKey()) {
  return `weekly-${lang === 'en' ? 'en' : 'ru'}@${week}`;
}

function hash(str) {
  let h = 2166136261;
  for (const ch of str) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

/** The week's text: two sentences picked from all of the language's texts by the week key. */
export function weeklyText(lang, week = weekKey()) {
  const pools = TEXTS[lang === 'en' ? 'en' : 'ru'];
  const all = Object.keys(pools).sort().flatMap(k => pools[k]);
  const h = hash(`${lang}:${week}`);
  const a = h % all.length;
  let b = (h >>> 8) % all.length;
  if (b === a) b = (a + 1) % all.length;
  return `${all[a]} ${all[b]}`;
}
