/**
 * Every interface language must translate every key, keep each placeholder
 * ({n}, {acc}, …) and the same HTML tags as the English text.
 */

import { getLocaleDict, getAvailableLanguages } from './i18n.js';

const en = getLocaleDict('en');
const placeholders = s => (s.match(/\{[a-z]+\}/g) || []).sort();
// Same kinds of tags, each opened and closed (the count may differ: e.g. the guide
// bolds the keys of each language's own keyboard layout)
const tags = s => {
  const all = s.match(/<\/?[a-z]+>/g) || [];
  const names = [...new Set(all.map(tag => tag.replace(/[</>]/g, '')))].sort();
  const balanced = names.every(n => all.filter(x => x === `<${n}>`).length === all.filter(x => x === `</${n}>`).length);
  return { names, balanced };
};

describe('interface translations', () => {
  it('offers all nine languages of the settings', () => {
    expect(getAvailableLanguages().sort()).toEqual(['de', 'en', 'es', 'fr', 'it', 'pl', 'pt', 'ru', 'uk']);
  });

  for (const lang of ['ru', 'de', 'fr', 'es', 'it', 'pt', 'pl', 'uk']) {
    describe(lang, () => {
      const dict = getLocaleDict(lang);

      it('has exactly the English keys', () => {
        expect(Object.keys(dict).filter(k => !(k in en))).toEqual([]);
        expect(Object.keys(en).filter(k => !(k in dict))).toEqual([]);
      });

      it('keeps placeholders and HTML tags, and leaves nothing empty', () => {
        for (const [key, text] of Object.entries(en)) {
          expect([key, placeholders(dict[key] || '')]).toEqual([key, placeholders(text)]);
          expect([key, tags(dict[key] || '')]).toEqual([key, tags(text)]);
          expect([key, (dict[key] || '').trim().length > 0]).toEqual([key, true]);
        }
      });
    });
  }
});
