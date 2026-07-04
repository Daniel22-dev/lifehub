# Modularizace LifeHubu

Tato verze je první bezpečný mezikrok k modulárnímu GitHub buildu.

## Co už je rozdělené

- `src/main.js` - vstupní bod aplikace pro Vite.
- `src/styles/lifehub.css` - styly importované přes build.
- `src/config/constants.js` - verze, limity, názvy úložišť, KDF konstanty.
- `src/pwa/register-sw.js` - registrace service workeru.
- `src/app/lifehub-app.js` - aplikační logika zatím ponechaná v jednom modulu, aby se nerozbily funkce.
- `public/vendor/` - lokální PDF.js kopie, kopírovaná beze změn do `dist/vendor/`.
- `public/sw.js` - service worker upravený pro Vite hashované assety.

## Proč není app logika rozsekaná najednou

Původní `lifehub.js` sdílí hodně uzavřeného stavu: `state`, `vaultKey`, `vaultSalt`, `currentPayroll`, `save()`, `renderAll()` a mnoho DOM vazeb. Prudké rozdělení do desítek souborů najednou by zvýšilo riziko regresí.

Doporučený další postup:

1. Zprovoznit build a deploy.
2. Přidat E2E smoke testy.
3. Teprve potom postupně vyjímat samostatné oblasti:
   - `security/crypto.js`
   - `storage/indexedDbVault.js`
   - `features/notes.js`
   - `features/finance.js`
   - `features/payrollPdf.js`
   - `features/vault.js`
   - `features/tasks.js`
   - `features/shopping.js`
   - `features/exports.js`

## Důležité změny pro Vite

- PDF.js cesty jsou odvozené od `import.meta.env.BASE_URL` přes `PUBLIC_BASE_URL`.
- Service worker už necachuje pevně `assets/lifehub.js`, protože Vite výstup bude hashovaný.
- Build publikuje složku `dist` přes GitHub Actions.


## Step 2: extracted core utilities

The first post-deploy modularization extracts safe, stateless helpers into `src/core/utils.js`:

- DOM selectors: `$`, `$$`
- dates and IDs: `today`, `monthNow`, `currentYear`, `uid`
- escaping and input safety: `esc`, `attr`, `safeId`, `safeUrl`, `safeCsvCell`, `sanitizeCurrency`
- numeric parsing: `number`

This intentionally does not split feature state yet. The goal is to keep behavior stable while gradually reducing the size of `src/app/lifehub-app.js`.


## Step 3 - tab-switch lock fix

During manual GitHub Pages testing, immediate locking on `visibilitychange` was too aggressive: the app locked when the user switched tabs to read instructions. The behavior is now changed so tab switching does not immediately lock the vault. The regular inactivity timeout remains the main automatic lock mechanism.

`lockApp()` is asynchronous now and waits for any pending encrypted save before wiping the runtime key and state. This reduces race risk when the user locks shortly after saving an item.

## Step 4 — core UI helpers

V tomto kroku byly z hlavního souboru `src/app/lifehub-app.js` vytaženy obecné UI helpery do `src/core/ui.js`:

- `toast()`
- `download()`
- `modalDialog()`
- `confirmDialog()`
- `passwordDialog()`

Cíl kroku: oddělit opakovaně používanou UI infrastrukturu od aplikačních funkcí. Nejde o změnu chování, jen o bezpečný mechanický přesun.

Další vhodný krok: vytažení kryptografických funkcí do `src/security/crypto.js`.
