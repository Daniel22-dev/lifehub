# LifeHub 4.8.2

LifeHub je osobní offline PWA pro poznámky, finance, výplatní pásky, splátky, účty a závazky, dokumenty, úkoly, nákupní seznam, zahradu a pracovní výkazy. Stav aplikace i lokální soubory jsou po odemčení uložené šifrovaně v zařízení.

## Novinky 4.8.1

- úvodní stránka už neopakuje stejné rychlé akce v bezpečnostním panelu,
- **Odměny** používají dvě skutečná období školního roku: září–prosinec a leden–červen; položky lze průběžně doplňovat a upravovat,
- sekce **AI výkaz** obsahuje živý náhled tiskové/PDF podoby i staženého HTML souboru,
- pořízené zahradní položky se přesunou do rozbalovacího archivu a neruší aktivní seznam,
- nestabilní systémový fullscreen byl nahrazen stabilním rozšířeným režimem,
- uhrazené účty a závazky se standardně zapisují jako propojené finanční výdaje,
- výplatní páska rozlišuje mzdové období a datum připsání; bilance období a skutečný hotovostní tok se zobrazují samostatně,
- pokud výplata za aktuální období ještě nepřišla, LifeHub zobrazí orientační odhad z posledních pásek,
- zachováno rychlé odemčení přes zabezpečení telefonu a vylepšené rodinné sdílení z verze 4.7.0.

## Finance a mzda

Záložka **Příjmy a výdaje** pracuje se dvěma pohledy:

1. **Bilance období** přiřadí mzdu měsíci, za který náleží.
2. **Hotovostní tok** respektuje skutečné datum připsání na účet.

U nové výplatní pásky proto vyplňte mzdové období i datum připsání. Uhrazené položky ze záložky **Účty a závazky** mají ve výchozím nastavení zapnuté automatické vytvoření propojeného výdaje.

## Soukromí

Zdrojový balík pro GitHub neobsahuje osobní data. Výplatní pásky, dokumenty, fotografie nákupních seznamů, zálohy a rodinné soubory se do repozitáře nikdy nevkládají. Přidávají se až po odemčení aplikace a zůstávají v lokálním šifrovaném úložišti konkrétního zařízení.

## Vývoj a kontrola

```bash
npm ci
npm run check
```

Kontrolní řetězec zahrnuje syntaxi, skener citlivých dat, automatické testy, smoke test a produkční Vite build.

## Nasazení

GitHub Pages je připraven přes workflow v `.github/workflows/deploy.yml`. Nahrajte obsah ZIPu do kořene stejného repozitáře. Po aktualizaci použijte původní hlavní heslo a následně vytvořte kompletní šifrovanou zálohu.


## Verze 4.8.2

Aktivní úkoly, velké nákupy a splátky jsou oddělené od dokončených položek v rozbalovacích archivech optimalizovaných pro telefon.
