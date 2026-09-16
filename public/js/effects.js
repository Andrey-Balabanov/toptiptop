/* Visual effects – particles, sparks, gifts, level-up banners, toasts */

import { t } from './i18n.js';

const GIFTS = ['🎁','🌟','⭐','✨','💎','🏆','🎯','⚡','🔥','💫','🎊','🎉','🍭','🎈'];

export function showParticle(x, y, text, color) {
  const p = document.createElement('div');
  p.className = 'particle';
  p.textContent = text;
  p.style.left = x + 'px';
  p.style.top = y + 'px';
  p.style.color = color;
  document.body.appendChild(p);
  setTimeout(() => p.remove(), 950);
}

export function showSparks(x, y, color, count = 6) {
  for (let i = 0; i < count; i++) {
    const s = document.createElement('div');
    s.className = 'spark';
    s.style.left = x + 'px'; s.style.top = y + 'px';
    s.style.background = color;
    s.style.boxShadow = '0 0 8px ' + color;
    const ang = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const dist = 30 + Math.random() * 30;
    const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist;
    s.animate(
      [{ transform: 'translate(0,0) scale(1)', opacity: 1 },
       { transform: `translate(${dx}px,${dy}px) scale(0)`, opacity: 0 }],
      { duration: 600, easing: 'ease-out' }
    );
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 600);
  }
}

export function flyGift(streak) {
  const count = Math.min(1 + Math.floor(streak / 50), 5);
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const g = document.createElement('div');
      g.className = 'gift';
      g.textContent = GIFTS[Math.floor(Math.random() * GIFTS.length)];
      g.style.left = (Math.random() * 80 + 10) + 'vw';
      document.body.appendChild(g);
      setTimeout(() => g.remove(), 2600);
    }, i * 180);
  }
}

export function showBigComboText(streak) {
  const el = document.createElement('div');
  el.className = 'combo-text';
  el.style.color = '#e0af68';
  el.innerHTML = t('effect.combo_text').replace('{streak}', streak);
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1400);
}

export function triggerLevelUpEffect(newLevel, levelTitle) {
  const flash = document.createElement('div');
  flash.className = 'flash';
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 800);

  const banner = document.createElement('div');
  banner.className = 'level-up-banner';
  banner.innerHTML = `${t('effect.level_up')} ${newLevel}!<br><span style="font-size:15px;font-weight:500;">${levelTitle}</span>`;
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 2500);

  for (let i = 0; i < 6; i++) setTimeout(() => flyGift(60), i * 130);
}

export function showAchievementToast(icon, name, desc) {
  const t2 = document.createElement('div');
  t2.className = 'toast';
  t2.innerHTML = `
    <div class="toast-title">${t('effect.achievement_unlocked')}</div>
    <div class="toast-content">
      <div class="toast-icon">${icon}</div>
      <div>
        <div class="toast-name">${name}</div>
        <div class="toast-desc">${desc}</div>
      </div>
    </div>`;
  document.body.appendChild(t2);
  setTimeout(() => t2.remove(), 4500);
}
