# LifeHub 4.8.4

LifeHub je osobní offline PWA pro poznámky, finance, výplatní pásky, splátky, účty a závazky, dokumenty, úkoly, nákupní seznam, zahradu a pracovní výkazy. Stav aplikace i lokální soubory jsou po odemčení uložené šifrovaně v zařízení.

## Novinky 4.8.4

- v úvodním **Přehledu** je nový měsíční finanční blok, který porovnává výplatu skutečně připsanou v daném kalendářním měsíci se všemi již provedenými i ještě plánovanými výdaji,
- do souhrnu se započítávají finanční transakce, jídlo a benzín, neuhrazené účty a faktury, trvalé příkazy, běžné splátky a zbývající část měsíčních limitů,
- běžná i mimořádná splátka se po zaznamenání automaticky propíše do **Příjmů a výdajů**,
- starší zaznamenané splátky se při prvním otevření doplní do finanční evidence a existující shodný ruční výdaj se přednostně propojí,
- opraven interaktivní manuál, který měl ve verzi 4.8.3 syntaktickou chybu.

### Dřívější změny 4.8.x

- úvodní stránka už neopakuje stejné rychlé akce v bezpečnostním panelu,
- **Odměny** používají dvě skutečná období školního roku: září–prosinec a leden–červen; položky lze průběžně doplňovat a upravovat,
- sekce **AI výkaz** vytváří barevný PDF/tisk a responzivní HTML výstup s logem školy; živý náhled byl kvůli výkonu telefonu odstraněn,
- pořízené zahradní položky se přesunou do rozbalovacího archivu a neruší aktivní seznam,
- nestabilní systémový fullscreen byl nahrazen stabilním rozšířeným režimem,
- uhrazené účty a závazky se standardně zapisují jako propojené finanční výdaje,
- výplatní páska rozlišuje mzdové období a datum připsání; bilance období a skutečný hotovostní tok se zobrazují samostatně,
- pokud výplata za aktuální období ještě nepřišla, LifeHub zobrazí orientační odhad z posledních pásek,
- rychlé odemčení přes zabezpečení telefonu, rodinné jméno a klikatelné odkazy jsou popsané přímo v aktualizovaném interaktivním manuálu,
- dokončené úkoly, koupené/odložené nákupy, pořízené zahradní věci a doplacené splátky jsou v rozbalovacích archivech.

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


## Verze 4.8.4

- interaktivní manuál je sjednocený s funkcemi verzí 4.7–4.8.4, včetně biometrie, rodinných URL, propojených financí a splátek, mzdového období, měsíčního souhrnu na Přehledu, prémiového AI výkazu a archivů dokončených položek.

Aktivní úkoly, velké nákupy a splátky jsou oddělené od dokončených položek v rozbalovacích archivech optimalizovaných pro telefon.
