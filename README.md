# LifeHub 5.0.1

Lokální šifrované osobní centrum pro poznámky, finance, dokumenty, úkoly, domácnost, zahradu, pracovní výkazy a větší projekty domu.

## Novinky 5.0.1

- ve **Velkých nákupech** lze zaškrtnout libovolnou kombinaci aktivních i odložených položek,
- společná cena se přepočítává okamžitě a výběr zůstává zachován při změně filtrů,
- souhrn upozorní na vybrané položky bez zadané ceny,
- právě zobrazené položky lze označit hromadně a celý výběr jedním tlačítkem vyčistit,
- kalkulačka je dočasná a po zamknutí aplikace se z bezpečnostních důvodů vymaže,
- projektové centrum domu, šifrované přílohy a všechny funkce verze 5.0.0 zůstávají zachovány.

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
- kompletní šifrovaná záloha včetně dokumentů, PDF a projektových příloh,
- automatický zámek a podpora WebAuthn PRF na kompatibilních zařízeních.

Podrobný přehled změn je v `CHANGELOG.md`. Interaktivní uživatelský návod je v `public/manual.html`.
