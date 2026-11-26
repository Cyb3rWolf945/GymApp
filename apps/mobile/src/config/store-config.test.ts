import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { palettes } from '../theme/tokens';

// Guards the store build config: the profiles exist, the assets the config points at are there, nothing secret is
// committed, and the app asks for no permissions it does not use.

const root = join(__dirname, '..', '..');
const read = (file: string) => readFileSync(join(root, file), 'utf8');
const eas = JSON.parse(read('eas.json'));
const app = JSON.parse(read('app.json')).expo;

describe('eas.json', () => {
  it('has development, preview and production build profiles', () => {
    expect(Object.keys(eas.build).sort()).toEqual(['development', 'preview', 'production']);
  });
  it('builds store files for production: an app bundle on Android, auto-incremented versions', () => {
    expect(eas.build.production.android.buildType).toBe('app-bundle');
    expect(eas.build.production.autoIncrement).toBe(true);
    expect(eas.cli.appVersionSource).toBe('remote');
  });
  it('builds the test profiles as installable files (simulator build and APK)', () => {
    expect(eas.build.development.ios.simulator).toBe(true);
    expect(eas.build.development.developmentClient).toBe(true);
    expect(eas.build.preview.android.buildType).toBe('apk');
  });
  it('submits to both stores, with the owner-only values left as placeholders', () => {
    expect(eas.submit.production.ios.ascAppId).toMatch(/OWNER/);
    expect(eas.submit.production.android.serviceAccountKeyPath).toContain('google-play-service-account.json');
    expect(eas.submit.production.android.releaseStatus).toBe('draft'); // never straight to the public
  });
  it('holds no secrets', () => {
    expect(read('eas.json')).not.toMatch(/sk_(live|test)_|eyJ[A-Za-z0-9_-]{20,}|service_role|BEGIN (RSA |EC )?PRIVATE KEY/);
  });
});

describe('app.json', () => {
  it('points at icon files that exist', () => {
    const files = [app.icon, app.android.adaptiveIcon.foregroundImage, app.web.favicon, app.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-splash-screen')[1].image];
    for (const f of files) expect(existsSync(join(root, f)), f).toBe(true);
  });
  it('uses the same identifier on iOS and Android and declares no non-exempt encryption', () => {
    expect(app.ios.bundleIdentifier).toBe(app.android.package);
    expect(app.ios.infoPlist.ITSAppUsesNonExemptEncryption).toBe(false);
  });
  it('asks for no Android permissions and does not claim iPad support', () => {
    expect(app.android.permissions).toEqual([]);
    expect(app.ios.supportsTablet).toBe(false);
  });
  it('keeps the dark brand colour for the splash and the adaptive icon', () => {
    // The splash and the adaptive icon sit on the dark palette's background, so the app opens without a colour jump.
    expect(app.backgroundColor).toBe(palettes.dark.background);
    expect(app.android.adaptiveIcon.backgroundColor).toBe(palettes.dark.background);
    const splash = app.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-splash-screen')[1];
    expect(splash.backgroundColor).toBe(palettes.dark.background);
  });
  it('has icon sources that draw the brand colours, and no transparency in the store icon', () => {
    const icon = read('assets/src/icon.svg');
    expect(icon).toMatch(/#C6FF3D/i); // the brand accent
    expect(icon).toMatch(new RegExp(`<rect width="1024" height="1024" fill="${palettes.dark.background}"`, 'i')); // opaque background
  });
  it('has PNGs of the sizes the stores need', () => {
    const size = (file: string) => {
      const b = readFileSync(join(root, 'assets', file));
      return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), colourType: b[25] };
    };
    expect(size('icon.png')).toMatchObject({ w: 1024, h: 1024 });
    expect(size('adaptive-icon.png')).toMatchObject({ w: 1024, h: 1024 });
    expect(size('splash-icon.png')).toMatchObject({ w: 1024, h: 1024 });
    expect(size('favicon.png')).toMatchObject({ w: 48, h: 48 });
    // PNG colour type 2 is RGB (no alpha channel: Apple rejects an icon with transparency), 6 is RGBA.
    expect(size('icon.png').colourType).toBe(2);
    expect(size('adaptive-icon.png').colourType).toBe(6); // the launcher draws its own background behind it
    expect(size('splash-icon.png').colourType).toBe(6);
  });
  it('keeps the Android service account key out of git', () => {
    const gitignore = readFileSync(join(root, '..', '..', '.gitignore'), 'utf8');
    expect(gitignore).toMatch(/google-play-service-account\.json/);
  });
});
