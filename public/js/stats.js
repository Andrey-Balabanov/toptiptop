/* Statistics window: speed/accuracy chart over recent texts and a mistakes
 * heatmap of the keyboard (per-key error rate from progress.keyStats).
 * The helpers at the top are pure and unit-tested; openStatsPanel renders.
 */

import { KB_ROWS_RU_DEFAULT, KB_ROWS_EN_DEFAULT } from './state.js';

/** Error rate at which a key is shown fully red. */
const RED_AT = 0.15;

/** Green (no mistakes) → yellow → red (≥ 15% mistakes). */
export function heatColor(rate) {
  const hue = Math.round(120 * (1 - Math.min(rate / RED_AT, 1)));
  return `hsl(${hue}, 65%, 45%)`;
}

export function keyErrorRate(stats) {
  if (!stats || stats.h + stats.m === 0) return null;
  return stats.m / (stats.h + stats.m);
}

/**
 * SVG polyline points for `values`, scaled into a w×h box (min..max on the y axis).
 * @returns {string} "x,y x,y …"
 */
export function linePoints(values, w, h, min, max) {
  if (values.length === 0) return '';
  const span = max - min || 1;
  const step = values.length > 1 ? w / (values.length - 1) : 0;
  return values
    .map((v, i) => {
      const x = values.length > 1 ? i * step : w / 2;
      const y = h - ((Math.min(Math.max(v, min), max) - min) / span) * h;
      return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
    })
    .join(' ');
}

/** Average of the last `n` values (null when empty). */
export function recentAverage(values, n = 10) {
  const last = values.slice(-n);
  return last.length ? last.reduce((s, v) => s + v, 0) / last.length : null;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function chartSvg(history, t) {
  const W = 560, H = 150, PAD = 28;
  const wpms = history.map(s => s.wpm);
  const accs = history.map(s => s.accuracy);
  const maxWpm = Math.max(20, Math.ceil(Math.max(...wpms) / 10) * 10);
  const wpmLine = linePoints(wpms, W - PAD * 2, H - 20, 0, maxWpm);
  const accLine = linePoints(accs, W - PAD * 2, H - 20, 50, 100);
  const avg = recentAverage(wpms, 10);
  return `
    <svg class="stats-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHtml(t('stats.chart_label'))}">
      <g transform="translate(${PAD},10)">
        <line x1="0" y1="${H - 20}" x2="${W - PAD * 2}" y2="${H - 20}" class="axis"/>
        <text x="-6" y="4" class="tick" text-anchor="end">${maxWpm}</text>
        <text x="-6" y="${H - 20}" class="tick" text-anchor="end">0</text>
        <text x="${W - PAD * 2 + 6}" y="4" class="tick acc">100%</text>
        <text x="${W - PAD * 2 + 6}" y="${H - 20}" class="tick acc">50%</text>
        <polyline points="${accLine}" class="line acc"/>
        <polyline points="${wpmLine}" class="line wpm"/>
      </g>
    </svg>
    <div class="stats-legend">
      <span class="lg wpm">— ${escapeHtml(t('stats.speed_wpm'))}</span>
      <span class="lg acc">— ${escapeHtml(t('stats.accuracy'))}</span>
      ${avg != null ? `<span>${escapeHtml(t('stats.avg_last10').replace('{n}', Math.round(avg)))}</span>` : ''}
    </div>`;
}

function heatmapHtml(keyStats, lang, t) {
  const rows = lang === 'ru' ? KB_ROWS_RU_DEFAULT : KB_ROWS_EN_DEFAULT;
  return rows.map(row => `<div class="hm-row">${row.map(key => {
    const s = keyStats[key];
    const rate = keyErrorRate(s);
    const style = rate == null ? '' : `style="background:${heatColor(rate)}"`;
    const tip = rate == null
      ? t('stats.no_data_key')
      : t('stats.key_tip').replace('{pct}', Math.round(rate * 100)).replace('{m}', s.m).replace('{n}', s.h + s.m);
    return `<span class="hm-key${rate == null ? ' empty' : ''}" ${style} title="${escapeHtml(key + ': ' + tip)}">${escapeHtml(key)}</span>`;
  }).join('')}</div>`).join('');
}

/**
 * Open the statistics window.
 * @param {{ keyStats: object, loadHistory: () => Promise<Array<{wpm:number, accuracy:number}>>,
 *           weakLetters: (lang: string) => string[], onTrain: (lang: string) => void,
 *           t: (key: string) => string, lang: string }} opts
 */
export function openStatsPanel(opts) {
  const { t } = opts;
  let lang = opts.lang === 'ru' ? 'ru' : 'en';
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal stats-modal">
      <h2>${escapeHtml(t('stats.title'))}</h2>
      <h3>${escapeHtml(t('stats.progress'))}</h3>
      <div class="stats-chart-wrap" id="stats-chart">${escapeHtml(t('stats.loading'))}</div>
      <h3>${escapeHtml(t('stats.heatmap'))}
        <select id="stats-lang" class="stats-lang">
          <option value="ru">РУ</option><option value="en">EN</option>
        </select>
      </h3>
      <div class="heatmap" id="stats-heatmap"></div>
      <div class="stats-weak" id="stats-weak"></div>
      <div class="modal-actions">
        <button class="primary-btn" id="stats-train">${escapeHtml(t('stats.train'))}</button>
        <button id="stats-close">${escapeHtml(t('stats.close'))}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelector('#stats-close').onclick = close;
  const onKey = e => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);

  const langSelect = overlay.querySelector('#stats-lang');
  langSelect.value = lang;
  const renderKeys = () => {
    overlay.querySelector('#stats-heatmap').innerHTML = heatmapHtml(opts.keyStats, lang, t);
    const weak = opts.weakLetters(lang);
    overlay.querySelector('#stats-weak').innerHTML = weak.length
      ? `${escapeHtml(t('stats.weakest'))} <b>${escapeHtml(weak.join(' '))}</b>`
      : escapeHtml(t('stats.no_weak'));
  };
  langSelect.onchange = () => { lang = langSelect.value; renderKeys(); };
  renderKeys();
  overlay.querySelector('#stats-train').onclick = () => { close(); opts.onTrain(lang); };

  opts.loadHistory().then(history => {
    const el = overlay.querySelector('#stats-chart');
    if (!el) return;
    el.innerHTML = history.length >= 2 ? chartSvg(history, t) : escapeHtml(t('stats.need_more'));
  }).catch(() => {
    const el = overlay.querySelector('#stats-chart');
    if (el) el.textContent = t('stats.load_error');
  });
}
