# LifeHub 5.3.0

Lokální šifrované osobní centrum pro skutečné cashflow, servisní historii vozu, poznámky, dokumenty, úkoly, domácnost, zahradu, pracovní výkazy, interaktivní postupy a větší projekty domu.

## Novinky 5.3.0

- **AI odměňování 2.0:** soukromá strukturovaná evidence práce na AI Studiu GHRAB, rozlišení kategorií, aplikací, pravidelné a mimořádné agendy a konkrétních výsledků.
- **Manažerský měsíční report:** výsledky, rizika, požadavky na vedení a priority; výstup neuvádí LifeHub a nikdy nepřenáší soukromé poznámky.
- **Beze změny modulu Odměny:** nadále slouží výhradně pro ostatní ne-AI činnosti.


- sekce **Elektřina – Marek** má jediné tlačítko **Stáhnout PDF pro Honzu Marka**,
- PDF se vytvoří lokálně a stáhne přímo bez náhledu celé aplikace a bez tiskového dialogu,
- export obsahuje přehled všech poznámek, nápadů a materiálových položek, souhrny, ceny a odkazy,
- delší obsah se automaticky rozdělí na více A4 stran,
- odstraněn nepotřebný CSV export a zastaralá instrukce „Uložit jako PDF“,
- přidán samostatný lokální PDF generátor a regresní testy proti návratu tiskové vrstvy.

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
- izolovaný prohlížeč nahraných HTML plánů bez přístupu k datům LifeHubu,
- whitelistová sanitizace importovaného stavu,
- nouzová šifrovaná záloha při selhání ukládání,
- kompletní šifrovaná záloha včetně dokumentů, PDF, projektových příloh a HTML plánů,
- automatický zámek a podpora WebAuthn PRF na kompatibilních zařízeních.

Podrobný přehled změn je v `CHANGELOG.md`. Interaktivní uživatelský návod je v `public/manual.html`.
