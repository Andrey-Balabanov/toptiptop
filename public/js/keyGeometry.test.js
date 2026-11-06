/**
 * Unit tests for keyGeometry.js — physical key widths and row offsets.
 */
import { keyboardFrame, boardUnits } from './keyGeometry.js';

const RU_ANSI = [
  ['1','2','3','4','5','6','7','8','9','0','-','='],
  ['й','ц','у','к','е','н','г','ш','щ','з','х','ъ'],
  ['ф','ы','в','а','п','р','о','л','д','ж','э'],
  ['я','ч','с','м','и','т','ь','б','ю','.'],
];
const RU_ISO = RU_ANSI.map((r, i) => (i === 3 ? ['\\', ...r] : r));
const EN_ANSI = [
  ['1','2','3','4','5','6','7','8','9','0','-','='],
  ['q','w','e','r','t','y','u','i','o','p','[',']','\\'],
  ['a','s','d','f','g','h','j','k','l',';','\''],
  ['z','x','c','v','b','n','m',',','.','/'],
];

const width = row => Math.round(row.reduce((s, k) => s + k.u, 0) * 100) / 100;

/** Centre of the key with `char`, in units from the left edge of the board. */
function centreOf(frame, char) {
  for (const row of frame) {
    let x = 0;
    for (const k of row) {
      if (k.char === char) return x + k.u / 2;
      x += k.u;
    }
  }
  return null;
}

describe('boardUnits()', () => {
  test('PC boards are 15u, MacBooks 14.5u', () => {
    expect(boardUnits('pc-ansi')).toBe(15);
    expect(boardUnits('pc-iso')).toBe(15);
    expect(boardUnits('mac-ansi')).toBe(14.5);
    expect(boardUnits('mac-iso')).toBe(14.5);
  });
});

describe('keyboardFrame()', () => {
  const cases = [
    ['pc-ansi', 'ru', RU_ANSI], ['pc-iso', 'ru', RU_ISO],
    ['mac-ansi', 'ru', RU_ANSI], ['mac-iso', 'ru', RU_ISO],
    ['pc-ansi', 'en', EN_ANSI], ['mac-ansi', 'en', EN_ANSI],
  ];

  test.each(cases)('%s/%s: every row spans the full board width', (layout, lang, rows) => {
    const frame = keyboardFrame(layout, lang, rows);
    expect(frame).toHaveLength(5);
    frame.forEach(row => expect(width(row)).toBe(boardUnits(layout)));
  });

  test.each(cases)('%s/%s: every character key from the data is kept', (layout, lang, rows) => {
    const frame = keyboardFrame(layout, lang, rows);
    const got = frame.flat().filter(k => k.kind === 'char').map(k => k.char);
    expect(got).toEqual(rows.flat());
  });

  test.each(cases)('%s/%s: И/B sits half a key right of П/G, midway between the index home keys', (layout, lang, rows) => {
    const frame = keyboardFrame(layout, lang, rows);
    const [g, h, b, f, j] = lang === 'ru' ? ['п', 'р', 'и', 'а', 'о'] : ['g', 'h', 'b', 'f', 'j'];
    expect(centreOf(frame, b) - centreOf(frame, g)).toBeCloseTo(0.5);
    expect(centreOf(frame, h) - centreOf(frame, b)).toBeCloseTo(0.5);
    expect(centreOf(frame, b) - centreOf(frame, f)).toBeCloseTo(centreOf(frame, j) - centreOf(frame, b));
  });

  test('home row starts 0.75u after the top row (Tab 1.5u, Caps 1.75u)', () => {
    const frame = keyboardFrame('pc-ansi', 'ru', RU_ANSI);
    expect(centreOf(frame, 'ф') - centreOf(frame, 'й')).toBeCloseTo(0.25);
    expect(centreOf(frame, 'й') - centreOf(frame, '1')).toBeCloseTo(0.5);
  });

  test('ANSI: long left Shift, wide backslash, one-row Enter', () => {
    const frame = keyboardFrame('pc-ansi', 'en', EN_ANSI);
    expect(frame[3][0]).toMatchObject({ kind: 'shift', side: 'left', u: 2.25 });
    expect(frame[1].at(-1)).toMatchObject({ char: '\\', u: 1.5 });
    expect(frame[2].at(-1)).toMatchObject({ name: 'enter', u: 2.25 });
    expect(frame[3].at(-1)).toMatchObject({ kind: 'shift', side: 'right', u: 2.75 });
  });

  test('ANSI RU without "\\" in the data still gets the 1.5u key', () => {
    const frame = keyboardFrame('pc-ansi', 'ru', RU_ANSI);
    expect(frame[1].at(-1)).toMatchObject({ kind: 'deco', label: '\\', u: 1.5 });
  });

  test('ISO: short left Shift with the extra key, two-part Enter', () => {
    const frame = keyboardFrame('pc-iso', 'ru', RU_ISO);
    expect(frame[3][0]).toMatchObject({ kind: 'shift', u: 1.25 });
    expect(frame[3][1]).toMatchObject({ char: '\\' });
    expect(frame[1].at(-1)).toMatchObject({ name: 'enter', part: 'top', u: 1.5 });
    expect(frame[2].at(-2)).toMatchObject({ kind: 'deco' });
    expect(frame[2].at(-1)).toMatchObject({ name: 'enter', part: 'bottom', u: 1.25 });
  });

  test('ё sits left of 1 for Russian; MacBook ISO English shows §', () => {
    expect(keyboardFrame('pc-ansi', 'ru', RU_ANSI)[0][0]).toMatchObject({ kind: 'deco', label: 'ё' });
    expect(keyboardFrame('mac-iso', 'en', EN_ANSI)[0][0]).toMatchObject({ label: '§' });
    expect(keyboardFrame('mac-ansi', 'en', EN_ANSI)[0][0]).toMatchObject({ label: '`' });
  });

  test('MacBook Russian: ] top-left, ё on the \\ key (ANSI) or left of return (ISO)', () => {
    const macRu = [RU_ANSI[0], [...RU_ANSI[1], 'ё'], RU_ANSI[2], [...RU_ANSI[3].slice(0, -1), '/']];
    const ansi = keyboardFrame('mac-ansi', 'ru', macRu);
    expect(ansi[0][0]).toMatchObject({ kind: 'deco', label: ']' });
    expect(ansi[1].at(-1)).toMatchObject({ char: 'ё' });
    const macRuIso = [RU_ANSI[0], RU_ANSI[1], [...RU_ANSI[2], 'ё'], macRu[3]];
    const iso = keyboardFrame('mac-iso', 'ru', macRuIso);
    expect(iso[0][0]).toMatchObject({ label: '>' });
    expect(iso[2].at(-2)).toMatchObject({ char: 'ё' });
    expect(iso[3][1]).toMatchObject({ kind: 'deco', label: ']' });
    for (const f of [ansi, iso]) f.forEach(row => expect(width(row)).toBe(14.5));
  });

  test('PC bottom row is Ctrl/Win/Alt, MacBook is fn/control/option/command + arrows', () => {
    const pc = keyboardFrame('pc-ansi', 'ru', RU_ANSI)[4].map(k => k.name || k.kind);
    expect(pc).toEqual(['ctrl', 'win', 'alt', 'space', 'alt', 'win', 'menu', 'ctrl']);
    const mac = keyboardFrame('mac-ansi', 'ru', RU_ANSI)[4].map(k => k.name || k.kind);
    expect(mac).toEqual(['fn', 'control', 'option', 'command', 'space', 'command', 'option', 'arrows']);
    expect(keyboardFrame('mac-ansi', 'ru', RU_ANSI)[3].at(-1)).toMatchObject({ side: 'right', u: 2.25 });
    expect(keyboardFrame('mac-ansi', 'ru', RU_ANSI)[0].at(-1)).toMatchObject({ name: 'backspace', u: 1.5, word: 'delete' });
  });

  test('extra-language rows (12-key home row) still fill the board', () => {
    const de = [
      ['1','2','3','4','5','6','7','8','9','0','ß'],
      ['q','w','e','r','t','z','u','i','o','p','ü','+'],
      ['a','s','d','f','g','h','j','k','l','ö','ä','#'],
      ['y','x','c','v','b','n','m',',','.','-'],
    ];
    for (const layout of ['pc-ansi', 'pc-iso', 'mac-ansi', 'mac-iso']) {
      keyboardFrame(layout, 'de', de).forEach(row => expect(width(row)).toBe(boardUnits(layout)));
    }
  });
});
