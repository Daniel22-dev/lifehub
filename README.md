# LifeHub 4.6.1

LifeHub je osobní offline PWA pro poznámky, finance, výplatní pásky, splátky, platby domácnosti, dokumenty, úkoly, nákupní seznam, zahradu a pracovní výkazy. Stav aplikace i lokální soubory jsou po odemčení uloženy šifrovaně v zařízení.

## Prémiové rozhraní 4.6.1

- nový osobní dashboard s dnešním souhrnem,
- spodní mobilní navigace a přehledné menu všech modulů,
- přepracovaná zamykací obrazovka,
- kompaktní bezpečnostní panel bez opakování stejných akcí,
- sjednocený vizuální systém pro počítač i telefon.

## Čistá mzda na první pohled

Výplatní karta zobrazuje jako hlavní údaj čistou mzdu. Částka skutečně připsaná na účet (dobírka), hrubá mzda a daň jsou samostatné vedlejší údaje. Do finančních transakcí se zapisuje skutečně vyplacená částka na účet.


## Co přinesla verze 4.5.1

- mobilní navigace bez duplicitních nadpisů skupin,

- mobilní hlavičku bez překrývání názvu, verze a stavu ukládání,
- srozumitelnější splátkový kalendář: aktivní kalendáře, měsíční úhrada a zbývající platby,
- automatické platby pro trvalé příkazy a inkasa bez měsíčního ručního odškrtávání,
- hromadné lokální načtení více PDF výplatních pásek,
- chytřejší hromadné vložení nákupního seznamu podle obchodů s náhledem,
- aktualizovaný interaktivní manuál přímo v aplikaci.

Bezpečnostní oprava 4.4.1 zůstává zachována: aplikace rozpozná původní trezor v IndexedDB i bezpečnostní migrační kopii a technickou chybu úložiště nezamění za nový prázdný trezor.

## Soukromí

Zdrojový balík pro GitHub neobsahuje osobní data. Výplatní pásky, dokumenty, fotografie nákupních seznamů, zálohy a rodinné soubory se do repozitáře nikdy nevkládají. Přidávají se až po odemčení aplikace a zůstávají v lokálním šifrovaném úložišti konkrétního zařízení.

## Výplatní pásky

Ve Financích lze:

1. vybrat jedno PDF a před uložením detailně zkontrolovat rozpoznané hodnoty,
2. vybrat více PDF najednou a použít **Hromadně uložit vybraná PDF**,
3. volitelně uložit původní PDF šifrovaně v zařízení,
4. importovat soukromý JSON s částkami bez fyzických PDF.

## Automatické platby

U pravidelné platby zaškrtněte **Hrazeno automaticky z účtu (trvalý příkaz / inkaso)**. Taková položka se nezobrazuje mezi ručními úhradami. Po dosažení termínu se zapíše do historie a posune na další období.

## Nákupní seznam

Hromadné vložení podporuje řádky, čárky i středníky. Pro více obchodů použijte například:

```text
Lidl:
mléko
chleba
2x vejce

Albert:
máslo, jogurty
```

Screenshot zůstává šifrovanou obrazovou přílohou; aplikace z něj automaticky nepřepisuje položky do odškrtávacího seznamu.

## Vývoj a kontrola

```bash
npm ci
npm run check
```

Kontrolní řetězec zahrnuje syntaxi, skener citlivých dat, automatické testy, smoke test a produkční Vite build.

## Nasazení

GitHub Pages je připraven přes workflow v `.github/workflows/deploy.yml`. Nahrajte obsah ZIPu do kořene stejného repozitáře. Po aktualizaci použijte původní PIN a následně vytvořte kompletní šifrovanou zálohu.
