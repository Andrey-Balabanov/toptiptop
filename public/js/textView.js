/* The text being typed: the full text in the top frame and the one-line strip
 * above the keyboard. Letters are built once per text and only re-coloured on
 * each keystroke; the frame's font shrinks to fit (the frame never grows).
 */

/** Characters shown on each side of the cursor in the one-line strip. */
const TYPE_LINE_SPAN = 40;

/**
 * @param {HTMLElement} textEl - the top text frame (#text)
 * @param {{ before: HTMLElement, after: HTMLElement }} line - halves of the one-line strip
 */
export function createTextView(textEl, line) {
  let charSpans = [];
  let builtText = null;
  let fittedText = null;
  let lastText = null;

  /**
   * Letters of a word are grouped in a non-breaking .word span so lines only wrap
   * at spaces/newlines (never mid-word); a newline forces a line break.
   */
  function build(text, isCode) {
    textEl.innerHTML = '';
    charSpans = [];
    // Code keeps its indentation readable only when left-aligned
    textEl.classList.toggle('code-text', isCode);
    let word = null;
    for (const ch of text) {
      const span = document.createElement('span');
      span.className = 'char';
      if (ch === ' ' || ch === '\n') {
        word = null;
        span.classList.add(ch === ' ' ? 'space' : 'newline');
        span.textContent = ch === ' ' ? ' ' : '↵';
        textEl.appendChild(span);
        if (ch === '\n') {
          const br = document.createElement('span');
          br.className = 'line-break';
          textEl.appendChild(br);
        }
      } else {
        if (!word) {
          word = document.createElement('span');
          word.className = 'word';
          textEl.appendChild(word);
        }
        span.textContent = ch;
        word.appendChild(span);
      }
      charSpans.push(span);
    }
    builtText = text;
  }

  /** Shrink the font until the text fits the frame. */
  function fit() {
    textEl.style.fontSize = '';
    if (lastText == null || textEl.clientHeight === 0) { fittedText = null; return; }
    let size = parseFloat(getComputedStyle(textEl).fontSize);
    while (textEl.scrollHeight > textEl.clientHeight + 1 && size > 10) {
      size = Math.max(10, size * 0.92);
      textEl.style.fontSize = size + 'px';
    }
    fittedText = lastText;
  }

  /** Typed text on the left, cursor + upcoming text on the right. */
  function paintLine(state) {
    line.before.innerHTML = '';
    line.after.innerHTML = '';
    const from = Math.max(0, state.pos - TYPE_LINE_SPAN);
    const to = Math.min(state.text.length, state.pos + TYPE_LINE_SPAN);
    for (let i = from; i < to; i++) {
      const span = document.createElement('span');
      span.className = 'char';
      const ch = state.text[i];
      span.textContent = ch === '\n' ? '↵' : ch;
      if (i < state.pos) span.classList.add(state.errors[i] ? 'wrong' : 'correct');
      else if (i === state.pos) span.classList.add('current');
      (i < state.pos ? line.before : line.after).appendChild(span);
    }
  }

  /** Show `state` (text, position, errors). */
  function paint(state, isCode = false) {
    lastText = state.text;
    if (builtText !== state.text) build(state.text, isCode);
    for (let i = 0; i < charSpans.length; i++) {
      const cls = i < state.pos ? (state.errors[i] ? 'wrong' : 'correct') : (i === state.pos ? 'current' : '');
      const span = charSpans[i];
      span.classList.toggle('correct', cls === 'correct');
      span.classList.toggle('wrong', cls === 'wrong');
      span.classList.toggle('current', cls === 'current');
    }
    paintLine(state);
    if (fittedText !== state.text) fit();
  }

  function clear() {
    textEl.innerHTML = '';
    line.before.innerHTML = '';
    line.after.innerHTML = '';
    builtText = null;
    lastText = null;
  }

  new ResizeObserver(() => fit()).observe(textEl);

  return { paint, clear };
}
