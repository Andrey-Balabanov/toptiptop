import { SKINS, resolveSkin } from './skins.js';

describe('resolveSkin', () => {
  it('shows no skin for "none" or an unknown choice', () => {
    expect(resolveSkin('none', 'programmer')).toBe(null);
    expect(resolveSkin('neon', 'programmer')).toBe(null);
  });

  it('shows a picked skin whatever the profile', () => {
    expect(resolveSkin('programmer', 'lawyer')).toBe('programmer');
  });

  it('follows the profile on "auto", falling back to general', () => {
    for (const profile of SKINS) expect(resolveSkin('auto', profile)).toBe(profile);
    expect(resolveSkin('auto', undefined)).toBe('general');
  });
});
