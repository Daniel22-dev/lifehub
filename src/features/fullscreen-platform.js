// Android Chrome owns the duration of its Fullscreen API safety banner.
// An installed PWA can run in manifest fullscreen mode without requesting
// element fullscreen; otherwise use the CSS focus layout on Android.
export function avoidNativeFullscreenOnAndroid(userAgent){
  return /\bAndroid\b/i.test(String(userAgent || ''));
}
