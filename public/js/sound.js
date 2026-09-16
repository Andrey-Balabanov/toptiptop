/* Web Audio API sound effects – generated programmatically */

let audioCtx = null;
let _muted = false;

const MUTED_KEY = 'toptip-muted';

export function isMuted() {
  return _muted;
}

export function setMuted(val) {
  _muted = val;
  try {
    localStorage.setItem(MUTED_KEY, val ? '1' : '0');
  } catch {}
}

export function toggleMuted() {
  setMuted(!_muted);
  return _muted;
}

export function loadMutedPref() {
  try {
    _muted = localStorage.getItem(MUTED_KEY) === '1';
  } catch {}
  return _muted;
}

function ensureCtx() {
  if (!audioCtx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(freq, duration, type = 'sine', volume = 0.15) {
  if (_muted) return;
  try {
    const ctx = ensureCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    // Audio not supported
  }
}

function playNoise(duration, volume = 0.04) {
  if (_muted) return;
  try {
    const ctx = ensureCtx();
    if (!ctx) return;
    const bufferSize = Math.ceil(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(ctx.currentTime);
  } catch (e) {
    // Audio not supported
  }
}

/* Public sound effects */

export function playCorrect() {
  playTone(520, 0.06, 'sine', 0.10);
}

export function playWrong() {
  playTone(180, 0.12, 'sawtooth', 0.08);
}

export function playCombo() {
  if (_muted) return;
  const notes = [523, 659, 784]; // C5, E5, G5
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.2, 'sine', 0.12), i * 80);
  });
}

export function playLevelUp() {
  if (_muted) return;
  const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.3, 'sine', 0.15), i * 100);
  });
  setTimeout(() => playNoise(0.3, 0.03), 400);
}

export function playAchievement() {
  if (_muted) return;
  playTone(784, 0.15, 'sine', 0.12);
  setTimeout(() => playTone(1047, 0.3, 'sine', 0.14), 120);
}

export function playKeyClick() {
  playNoise(0.03, 0.03);
}
