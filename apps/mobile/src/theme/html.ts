import { THEME_STORAGE_KEY } from './preference';
import { palettes } from './tokens';

/**
 * The CSS for the page itself, written into the HTML before any script runs, so the browser never paints its own white
 * (or a dark page under a light app). Dark is the default; a light system theme switches to light; a saved choice
 * (`data-scheme`, set by a tiny script in the head from the saved preference) wins over the system.
 */
export function pageThemeCss(): string {
  const dark = palettes.dark.background;
  const light = palettes.light.background;
  const paint = (c: string, scheme: string) => `color-scheme:${scheme};background-color:${c}`;
  return [
    `html,body,#root{${paint(dark, 'dark')}}`,
    `@media (prefers-color-scheme: light){html:not([data-scheme]),html:not([data-scheme]) body,html:not([data-scheme]) #root{${paint(light, 'light')}}}`,
    `html[data-scheme="light"],html[data-scheme="light"] body,html[data-scheme="light"] #root{${paint(light, 'light')}}`,
    `html[data-scheme="dark"],html[data-scheme="dark"] body,html[data-scheme="dark"] #root{${paint(dark, 'dark')}}`,
  ].join('\n');
}

/** Runs first in the head: puts the saved choice (Dark or Light) on `<html>` before the first paint. System needs nothing. */
export const SAVED_SCHEME_SCRIPT = `try{var p=localStorage.getItem('${THEME_STORAGE_KEY}');if(p==='dark'||p==='light')document.documentElement.dataset.scheme=p}catch(e){}`;

/** The react-native-web page reset: a full-height body and root, with body scrolling off (the app scrolls itself). */
export const PAGE_RESET_CSS = `html,body{height:100%}
body{overflow:hidden}
#root{display:flex;height:100%;flex:1}`;

/**
 * The web page for the single-page build (`web.output: "single"`, where `app/+html.tsx` is not used): the template the
 * Expo CLI fills in (`%LANG_ISO_CODE%`, `%WEB_TITLE%`, the scripts). Written to `apps/mobile/public/index.html` by
 * `pnpm tsx scripts/write-web-index.ts`; a unit test fails if the file and this function disagree. The colours are the
 * same as in `+html.tsx`: the page is painted in the theme background before any script runs.
 */
export function indexHtml(): string {
  const dark = palettes.dark.background;
  const light = palettes.light.background;
  return `<!DOCTYPE html>
<html lang="%LANG_ISO_CODE%" style="color-scheme: dark light">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
    <meta name="color-scheme" content="dark light" />
    <meta name="theme-color" content="${dark}" media="(prefers-color-scheme: dark)" />
    <meta name="theme-color" content="${light}" media="(prefers-color-scheme: light)" />
    <title>%WEB_TITLE%</title>
    <script>${SAVED_SCHEME_SCRIPT}</script>
    <style id="expo-reset">
${PAGE_RESET_CSS}
    </style>
    <style id="page-theme">
${pageThemeCss()}
    </style>
  </head>
  <body>
    <noscript> You need to enable JavaScript to run this app. </noscript>
    <div id="root"></div>
  </body>
</html>
`;
}
