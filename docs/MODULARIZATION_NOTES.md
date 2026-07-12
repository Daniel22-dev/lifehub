# Modularizace LifeHubu 4.4.0

## Aktuální stav

LifeHub používá Vite a hlavní aplikační controller zůstává v `src/app/lifehub-app.js`, ale bezpečnostně a logicky samostatné části jsou oddělené do testovatelných modulů.

### Core

- `src/core/utils.js` – datum, ID, escapování, URL a CSV ochrany.
- `src/core/ui.js` – dialogy, focus trap, bezpečné uzavření a vyčištění modálních oken, toast a download.
- `src/core/save-lifecycle.js` – stavy `dirty / pending / failed / saved` a blokace nebezpečného zamknutí.
- `src/core/state-integrity.js` – migrace `schemaVersion` a oprava duplicitních ID v importech.

### Security, storage a PWA

- `src/security/crypto.js` – PBKDF2, AES-GCM a kryptografická validace.
- `src/storage/indexed-db.js` – šifrovaný stav, PDF, dokumenty a obnovovací metadata v IndexedDB.
- `src/pwa/register-sw.js` a `public/sw.js` – bezpečný životní cyklus PWA a precache hashovaných build assetů.

### Features

- `backup.js`, `backup-validation.js`
- `budget.js`
- `family-snapshot.js`
- `finance.js`
- `installments.js`
- `payroll-elanor.js`
- `recurring-payments.js`

## Co bylo ve 4.4.0 zlepšeno

- Hlavní stav se přesunul z `localStorage` do IndexedDB.
- Ukládání slučuje rychlé změny krátkým debounce a drží pouze nejnovější snapshot.
- Překreslení vyvolaná uložením se dávkují přes `requestAnimationFrame`.
- Rodinný export, splátky, opakované termíny, integrita stavu a životní cyklus ukládání jsou samostatně testovatelné.
- Odstraněna nepoužívaná obousměrná rodinná synchronizace.

## Záměrně ponechaná hranice

Úplné rozdělení všech DOM obrazovek do samostatných controllerů nebylo provedeno jednorázově. Hlavní modul sdílí stav, klíč trezoru a vykreslování 18 částí. Mechanické rozsekání bez plnohodnotných browserových E2E testů by zvýšilo riziko regresí v produkční osobní aplikaci.

Další nové funkce proto mají vznikat v samostatných modulech a z hlavního controlleru se mají postupně vyjímat celé uzavřené oblasti, nikoli jednotlivé náhodné funkce.
