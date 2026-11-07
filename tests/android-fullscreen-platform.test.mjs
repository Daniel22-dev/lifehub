import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { avoidNativeFullscreenOnAndroid } from '../src/features/fullscreen-platform.js';

test('Android phones use CSS focus instead of a native Fullscreen API request', () => {
  assert.equal(avoidNativeFullscreenOnAndroid('Mozilla/5.0 (Linux; Android 16; Mobile) AppleWebKit/537.36 Chrome/140'), true);
  assert.equal(avoidNativeFullscreenOnAndroid('Mozilla/5.0 (Linux; Android 14; Pixel Tablet) Chrome/140'), true);
  assert.equal(avoidNativeFullscreenOnAndroid('Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X)'), false);
  assert.equal(avoidNativeFullscreenOnAndroid('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), false);
});

test('fullscreen PWA does not request native fullscreen on Android and keeps user data code unchanged', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../public/manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.display, 'fullscreen');
  assert.equal(manifest.id, './');
  assert.equal(manifest.start_url, './index.html');
  assert.equal(manifest.scope, './');

  const app = fs.readFileSync(new URL('../src/app/lifehub-app.js', import.meta.url), 'utf8');
  assert.match(app, /if\(avoidNativeFullscreenOnAndroid\(navigator\.userAgent\)\)\{[\s\S]*?fullscreenMode='fallback';[\s\S]*?return;[\s\S]*?\}\s*document\.body\.classList\.add\('focus-mode'\);/);
  assert.match(app, /else if\(avoidNativeFullscreenOnAndroid\(navigator\.userAgent\)\) shell\.classList\.toggle\('plan-frame-expanded'\);/);
  assert.match(app, /await requestNativeFullscreen\(\)/);
  assert.match(app, /await exitNativeFullscreen\(\)/);
  assert.match(app, /#fullscreenBtn/);
});

test('service worker changes shell version without modifying data storage or caches outside its own shell', () => {
  const sw = fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  assert.match(sw, /lifehub-vite-shell-v5-4-0-android-pwa-fullscreen/);
  assert.match(sw, /cache\.addAll\(critical\)/);
  assert.doesNotMatch(sw, /indexedDB\.deleteDatabase/);
});
