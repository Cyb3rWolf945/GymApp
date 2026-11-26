import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SAVED_SCHEME_SCRIPT, indexHtml, pageThemeCss } from './html';
import { navigationColors, navigationTheme } from './navigation';
import { palettes } from './tokens';

describe('navigation theme', () => {
  it.each(['dark', 'light'] as const)('%s: every colour comes from the palette', (scheme) => {
    const p = palettes[scheme];
    expect(navigationTheme(scheme).colors).toEqual({
      primary: p.accent,
      background: p.background,
      card: p.surface,
      text: p.text,
      border: p.border,
      notification: p.danger,
    });
  });
  it('knows which kind of theme it is', () => {
    expect(navigationTheme('dark').dark).toBe(true);
    expect(navigationTheme('light').dark).toBe(false);
  });
  it('the background behind every screen is the app background, never the navigation library default', () => {
    // React Navigation's own light theme is rgb(242, 242, 242); its dark one rgb(1, 1, 1): neither is ours.
    for (const scheme of ['dark', 'light'] as const) {
      const bg = navigationColors(palettes[scheme]).background;
      expect(bg).toBe(palettes[scheme].background);
      expect(bg.toLowerCase()).not.toBe('#f2f2f2');
    }
  });
  it('dark and light give different backgrounds (so a scheme change is a real change)', () => {
    expect(navigationTheme('dark').colors.background).not.toBe(navigationTheme('light').colors.background);
  });
});

describe('page theme css', () => {
  const css = pageThemeCss();
  it('paints html, body and the root in the dark background by default', () => {
    expect(css).toContain(`html,body,#root{color-scheme:dark;background-color:${palettes.dark.background}}`);
  });
  it('switches to the light background for a light system theme, unless a choice is saved', () => {
    expect(css).toMatch(/@media \(prefers-color-scheme: light\)\{html:not\(\[data-scheme\]\)/);
    expect(css).toContain(palettes.light.background);
  });
  it('lets a saved Dark or Light choice win over the system', () => {
    expect(css).toContain(`html[data-scheme="light"],html[data-scheme="light"] body,html[data-scheme="light"] #root{color-scheme:light;background-color:${palettes.light.background}}`);
    expect(css).toContain(`html[data-scheme="dark"]`);
  });
  it('reads the same storage key the app saves the choice under, and only accepts Dark or Light', () => {
    expect(SAVED_SCHEME_SCRIPT).toContain("localStorage.getItem('fuelift.theme')");
    expect(SAVED_SCHEME_SCRIPT).toContain("p==='dark'||p==='light'");
  });
});

describe('the web page template (single-page build)', () => {
  const html = indexHtml();
  it('is what is committed in public/index.html: run `pnpm tsx scripts/write-web-index.ts` after changing the theme', () => {
    expect(readFileSync(join(__dirname, '..', '..', 'public', 'index.html'), 'utf8')).toBe(html);
  });
  it('keeps the placeholders the Expo CLI fills in, and the root element', () => {
    expect(html).toContain('%LANG_ISO_CODE%');
    expect(html).toContain('%WEB_TITLE%');
    expect(html).toContain('<div id="root"></div>');
  });
  it('paints the page in the theme background before any script, with theme-color metas for both schemes', () => {
    expect(html).toContain(pageThemeCss());
    expect(html).toContain(`<meta name="theme-color" content="${palettes.dark.background}" media="(prefers-color-scheme: dark)" />`);
    expect(html).toContain(`<meta name="theme-color" content="${palettes.light.background}" media="(prefers-color-scheme: light)" />`);
    expect(html).toContain('<meta name="color-scheme" content="dark light" />');
    expect(html.indexOf('page-theme')).toBeLessThan(html.indexOf('<body>'));
  });
});
