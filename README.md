# LifeHub 5.0.0

Lokální šifrované osobní centrum pro poznámky, finance, dokumenty, úkoly, domácnost, zahradu, pracovní výkazy a větší projekty domu.

## Novinky 5.0.0

- nová záložka **Projekty domu** pro bazén, přístřešek, koupelnu, dlažbu a další rozsáhlejší záměry,
- projektové zadání, požadavky, stav, priorita, termíny a tagy,
- položkový rozpočet s plánem, skutečností, dodavateli, nabídkami a odkazy,
- projektové poznámky a odkazy na ChatGPT, Claude, Gemini, weby a dodavatele,
- šifrované obrázky, PDF, dokumenty, tabulky a vlastní kreslené náčrty,
- export celého projektu do Markdownu a rozpočtu do CSV,
- projektové soubory jsou součástí úplné kontroly kompletní šifrované zálohy.

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
