import type { ReactNode } from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';
import { SAVED_SCHEME_SCRIPT, pageThemeCss } from '../src/theme/html';
import { palettes } from '../src/theme/tokens';

/**
 * The web page around the app, written once at build time. It paints the theme background on html, body and the root
 * element before any script runs, so the browser never shows white (or a wrong dark) before React renders, between
 * routes, during fades or on overscroll. Dark by default, light for a light system theme, and a saved choice wins.
 */
export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="en" style={{ colorScheme: 'dark light' }}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="color-scheme" content="dark light" />
        <meta name="theme-color" content={palettes.dark.background} media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content={palettes.light.background} media="(prefers-color-scheme: light)" />
        <script dangerouslySetInnerHTML={{ __html: SAVED_SCHEME_SCRIPT }} />
        {/* Full-height body and root, with body scrolling off (the react-native-web reset). */}
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: pageThemeCss() }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
