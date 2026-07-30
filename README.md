# LifeHub 5.2.1

Lokální šifrované osobní centrum pro skutečné cashflow, servisní historii vozu, poznámky, dokumenty, úkoly, domácnost, zahradu, pracovní výkazy, interaktivní postupy a větší projekty domu.

## Novinky 5.2.1

- kompletní historie z **Moje Fabia** se automaticky přenáší v šifrovaném rodinném souboru,
- manželka po načtení uvidí samostatný panel s celou servisní historií pouze ke čtení,
- nová záložka **Moje Fabia** pro Škodu Fabia I 1.2 HTP, rok výroby 2004/2005,
- evidence data, tachometru, typu události, popisu, ceny, plátce a poznámky,
- čtyři pevné typy: Garanční servis, Oprava, STK + emise a Ostatní,
- volitelné automatické propojení každého záznamu s finanční evidencí bez duplicit,
- karta **Z poslední výplaty zbývá** založená na skutečném datu připsání mzdy,
- měsíční i roční přehledy používají skutečná data příjmů a plateb,
- jídlo a benzín jsou zahrnuty do skutečných výdajů i ročního grafu,
- datové schéma zvýšeno na verzi 14 s bezpečnou migrací historie vozu.

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
