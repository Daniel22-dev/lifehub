# LifeHub 4.8.6 — opravné vydání

## Kritické opravy

- Doplněna chybějící funkce `merge()` v migraci starších nešifrovaných dat.
- Nečitelná nebo neplatná legacy data již nevedou k tichému vytvoření prázdného trezoru.
- Migrace se při chybě zastaví před zápisem a původní data ponechá beze změny.
- Vlastní dešifrovaný trezor již nepoužívá osmimabajtový limit určený pro cizí importy.
- Přidán ESLint s pravidlem `no-undef`; kontrola běží jako první část `npm run check`.

## Finance a výplatní pásky

- Hrubá mzda se již nikde nepoužívá jako částka připsaná na účet.
- Opraven Přehled, uložení jedné pásky, hromadný PDF import, JSON import, odhady a automatické doplnění transakcí.
- Páska bez čisté mzdy nebo částky na účet se uloží bez příjmové transakce a uživatel dostane upozornění.
- Starší automaticky vytvořená transakce přesně ve výši hrubé mzdy se při odemčení odstraní.
- Ručně opravená částka se zachová.

## Výkaz a PWA

- Dynamické barvy měsíčního výkazu fungují pod stávající přísnou CSP bez přidání `unsafe-inline`.
- CSS proměnné mají fallbacky v aplikaci i v samostatném HTML výkazu.
- Instalace service workeru přežije selhání nepovinného assetu.
- Navigace po třech sekundách pomalé sítě použije dostupný uložený `index.html`.

## Údržba

- Odstraněn mrtvý modul `family-sync.js` a jeho test.
- Odstraněny nepoužívané funkce a nereferencované kopie assetů.
- Verze, cache, manuál, README, changelog a testy sjednoceny na 4.8.6.
- Přidáno 17 regresních testů; celkem 92/92 testů prochází.
