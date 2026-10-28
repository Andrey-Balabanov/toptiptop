/* Result share card: draws a 1200×630 picture of a finished text (speed,
 * accuracy, streak, level) and shares it with the system share sheet, or —
 * where that can't share files (most desktops) — downloads the picture and
 * copies a short text with the link to the clipboard.
 */

const W = 1200;
const H = 630;
const FINGER_COLORS = ['#f7768e', '#ff9e64', '#e0af68', '#9ece6a', '#73daca', '#7aa2f7', '#bb9af7', '#ff9e9e'];

/** Short text that goes with the picture (also used alone where files can't be shared). */
export function shareText(data, t) {
  return t('share.text')
    .replace('{wpm}', data.wpm)
    .replace('{acc}', data.accuracy)
    .replace('{url}', data.url);
}

/**
 * Draw the card on a canvas.
 * @param {HTMLCanvasElement} canvas
 * @param {{ wpm:number, accuracy:number, errors:number, level:number, streak:number, url:string }} data
 */
export function drawShareCard(canvas, data, t) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#1a1b26');
  bg.addColorStop(1, '#24283b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // A row of finger-coloured keys along the top
  const keyW = 110, gap = 18, x0 = (W - (keyW * 8 + gap * 7)) / 2;
  FINGER_COLORS.forEach((c, i) => {
    ctx.fillStyle = c;
    roundRect(ctx, x0 + i * (keyW + gap), 48, keyW, 26, 8);
  });

  ctx.textAlign = 'center';
  ctx.fillStyle = '#c0caf5';
  ctx.font = '600 44px -apple-system, "Segoe UI", system-ui, sans-serif';
  ctx.fillText('TopTipTop', W / 2, 150);

  ctx.fillStyle = '#7aa2f7';
  ctx.font = '800 190px -apple-system, "Segoe UI", system-ui, sans-serif';
  ctx.fillText(String(data.wpm), W / 2, 345);
  ctx.fillStyle = '#9aa5ce';
  ctx.font = '500 36px -apple-system, "Segoe UI", system-ui, sans-serif';
  ctx.fillText(t('share.wpm_label'), W / 2, 395);

  const stats = [
    [t('share.accuracy'), data.accuracy + '%', '#9ece6a'],
    [t('share.errors'), String(data.errors), '#f7768e'],
    [t('share.level'), String(data.level), '#e0af68'],
    [t('share.days'), '🔥 ' + data.streak, '#ff9e64'],
  ];
  const colW = W / stats.length;
  stats.forEach(([label, value, color], i) => {
    const cx = colW * i + colW / 2;
    ctx.fillStyle = color;
    ctx.font = '700 54px -apple-system, "Segoe UI", system-ui, sans-serif';
    ctx.fillText(value, cx, 495);
    ctx.fillStyle = '#9aa5ce';
    ctx.font = '500 26px -apple-system, "Segoe UI", system-ui, sans-serif';
    ctx.fillText(label, cx, 535);
  });

  ctx.fillStyle = '#565f89';
  ctx.font = '500 26px -apple-system, "Segoe UI", system-ui, sans-serif';
  ctx.fillText(data.url.replace(/^https?:\/\//, ''), W / 2, 595);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

/**
 * Share the result. Resolves to 'shared' | 'downloaded' | 'cancelled'.
 */
export async function shareResult(data, t) {
  const canvas = document.createElement('canvas');
  drawShareCard(canvas, data, t);
  const text = shareText(data, t);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  const file = new File([blob], `toptiptop-${data.wpm}wpm.png`, { type: 'image/png' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text, title: 'TopTipTop' });
      return 'shared';
    } catch (err) {
      if (err && err.name === 'AbortError') return 'cancelled';
      // fall through to download
    }
  }

  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  try { await navigator.clipboard.writeText(text); } catch {}
  return 'downloaded';
}
