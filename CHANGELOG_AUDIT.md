# LifeHub 3.1 Secure Fixed – výpis oprav

Zdroj: původní monolit `lifehub-3-0-secure-vault-monolith.html`.

## P0 bezpečnostní opravy

- Odstraněn CDN fallback na PDF.js 3.11.174.
- Přidán lokální PDF.js `pdfjs-dist` 6.0.227 jako `vendor/pdf.min.mjs` a `vendor/pdf.worker.min.mjs`.
- PDF import používá `isEvalSupported:false` a `stopAtErrors:true`.
- PDF import má limit velikosti 10 MB a čte maximálně prvních 5 stran.
- CSP je zpřísněna: bez `unsafe-inline`, bez CDN, se `frame-ancestors 'none'`.
- Inline CSS a JS byly přesunuty do `assets/lifehub.css` a `assets/lifehub.js`.
- Odstraněny inline `style="..."` atributy z hlavní aplikace.
- `idbPut()` už nikdy neukládá plaintext fallback; bez odemčeného trezoru vyhodí chybu.
- `lockApp()` čistí citlivý runtime: PDF input, raw text, rozepsané formuláře, náhled exportu a globální hledání.
- Při zamčení je aplikace za dialogem nastavena jako `inert` a `aria-hidden`.
- Doplněn focus trap na lock screen a blokování Escape.
- Při skrytí záložky se odemčená aplikace zamkne.

## Funkční opravy

- Dynamické výsledky globálního hledání s `data-jump` jsou obsloužené delegovaným click handlerem.
- `monthNow()` už nepoužívá datum vytvořené při načtení stránky, ale aktuální datum při každém volání.
- Uložení výplatní pásky nejdříve řeší potvrzení nahrazení staršího mzdového příjmu, teprve poté ukládá PDF do IndexedDB.
- Mazání PDF/dokumentů v IndexedDB už nemění metadata, pokud se fyzické smazání nepovede.
- `renderAll()` volá doplnění přístupnostních labelů.
- `kpi()` už defaultně escapuje hodnotu; pro záměrné HTML je zvláštní `kpiHtml()`.

## Import/export a soukromí

- Import výplatních pásek sanitizuje `evidence` objekt, nebere ho raw.
- Soukromé exporty nově žádají potvrzení.
- Anonymizovaný export už neponechává přesné měsíce a přesné finanční částky.
- Anonymizovaný export používá kvartály a finanční rozsahy.
- Anonymizované CSV výplatních pásek exportuje rozsahy místo přesných částek.

## UX/PWA

- Přidán `manifest.json`, `icon.svg`, PNG ikony a jednoduchý `sw.js`.
- README vysvětluje spuštění přes lokální server / GitHub Pages.
- Texty v UI upraveny tak, aby odpovídaly šifrovanému lokálnímu trezoru.

## Kontroly

- `node --check assets/lifehub.js` prošel bez chyby.
- V hlavní aplikaci nezůstaly inline `style="..."` atributy.
- V hlavní aplikaci nezůstaly `unsafe-inline`, `cdnjs`, `PDF_JS_CDN`, `pdf.min.js` ani `pdf.worker.min.js` odkazy.

## Poznámka

Aplikace je pořád statická klientská aplikace. To znamená, že po odemčení má běžící JavaScript v dané stránce přístup k odemčeným datům. Proto je zásadní používat důvěryhodný hosting, neinstalovat cizí rozšíření prohlížeče s přístupem ke stránkám a nepřidávat do aplikace externí skripty.

## 3.1.1 Secure Fixed - před modularizací

- Opraveno: `deriveVaultKey()` a `deriveBackupKey()` nově respektují uložený počet PBKDF2 iterací z obálky/zálohy.
- Opraveno: migrace starých plaintext souborů do IndexedDB se při založení trezoru čeká pomocí `await`.
- Opraveno: při odmítnutí migrace starších plaintext dat aplikace nabídne jejich bezpečné odstranění nebo založení trezoru zruší.
- Opraveno: nativní `prompt()` a `confirm()` byly nahrazeny vlastními modálními dialogy s focus trapem a validací hesla.
- Opraveno: escapování kategorie dokumentů ve výpisu archivu.
- Opraveno: sanitizace měny v nastavení, importu a finančních výstupech.
- Opraveno: doplněn chybějící `</body>` v `index.html`.
- Opraveno: aktualizována cache verze v `sw.js`.
- Kontrola: `node --check assets/lifehub.js` a `node --check sw.js` prošly bez chyby.

## 3.1.3 - modularization step 2

- Extracted shared DOM/date/string/sanitization helpers into `src/core/utils.js`.
- Kept application behavior unchanged: `src/app/lifehub-app.js` still owns feature state and rendering.
- Updated syntax-check script to include the new utility module.

