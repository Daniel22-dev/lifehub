# LifeHub 4.8.6

Lokální šifrované osobní centrum pro poznámky, finance, dokumenty, úkoly, domácnost, zahradu a pracovní výkazy.

## Novinky 4.8.6

- kritická oprava migrace starších nešifrovaných dat: nečitelný nebo neplatný stav už nikdy nepokračuje k zápisu prázdného trezoru,
- vlastní dešifrovaný trezor už není omezen osm megabajty určenými pro cizí importy,
- měsíční výkaz vykresluje graf a barevné prvky i při přísné Content Security Policy,
- výplatní páska bez čisté mzdy nebo částky na účet už nevytvoří příjem z hrubé mzdy,
- service worker přežije výpadek nepovinného souboru a při pomalé síti použije po třech sekundách uloženou aplikaci,
- kontrolní řetězec začíná ESLintem a odhalí nedefinované funkce ještě před testy,
- odstraněn nepoužívaný modul rodinné synchronizace a nereferencované kopie souborů.

## Kontrola před vydáním

```bash
npm ci
npm run check
```

Řetězec provede ESLint, syntaktickou kontrolu, kontrolu citlivých dat, automatické testy, smoke test a produkční build.

## Důležité bezpečnostní vlastnosti

- lokální trezor AES-GCM 256,
- odvození klíče PBKDF2-SHA256,
- přísná CSP bez síťových spojení aplikace,
- whitelistová sanitizace importovaného stavu,
- nouzová šifrovaná záloha při selhání ukládání,
- automatický zámek a podpora WebAuthn PRF na kompatibilních zařízeních.

Podrobný přehled změn je v `CHANGELOG.md`. Interaktivní uživatelský návod je v `public/manual.html`.
