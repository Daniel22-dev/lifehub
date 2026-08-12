# LifeHub 5.4.0

Lokální šifrované osobní centrum pro skutečné cashflow, servisní historii vozu, poznámky, dokumenty, úkoly, domácnost, zahradu, pracovní výkazy, interaktivní postupy a větší projekty domu.

## Novinky 5.4.0

- **Přímé PDF odměn:** skutečný lokálně vytvořený PDF soubor se stáhne bez tiskového dialogu a delší report se automaticky stránkuje.
- **Přílohy poznámek:** k poznámkám lze šifrovaně uložit PDF, DOCX a interaktivní HTML; kompletní záloha je přenese mezi zařízeními.
- **Kalendářní výplata:** po načtení nové pásky se zůstatek přepočítá od 1. dne měsíce jejího skutečného připsání.


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
- kompletní šifrovaná záloha včetně dokumentů, PDF, příloh poznámek, projektových příloh a HTML plánů,
- automatický zámek a podpora WebAuthn PRF na kompatibilních zařízeních.

Podrobný přehled změn je v `CHANGELOG.md`. Interaktivní uživatelský návod je v `public/manual.html`.
