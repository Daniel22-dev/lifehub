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
