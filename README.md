# LifeHub 5.1.0

Lokální šifrované osobní centrum pro poznámky, finance, dokumenty, úkoly, domácnost, zahradu, pracovní výkazy, interaktivní postupy a větší projekty domu.

## Novinky 5.1.0

- samostatná záložka **Plány a postupy** v části Dům a technika,
- šifrované ukládání interaktivních HTML plánů a jejich bezpečné spuštění v sandboxu,
- zachovaný samostatný modul **Projekty domu**,
- plátce **Já / Manželka** u všech relevantních skutečných výdajů,
- osobní bilance odečítá pouze výdaje zaplacené uživatelem,
- celkové náklady domácnosti nadále zahrnují výdaje obou osob,
- filtrování měsíčních a ročních výdajů podle plátce,
- kompletní záloha přenáší také HTML plány.

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
