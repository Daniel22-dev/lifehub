# LifeHub 3.1.6-modular-step-5 – výpis změn

Verze aplikace: `3.1.6-modular-step-5` (sjednoceno v `src/config/constants.js` i `package.json`).

## Splátkový kalendář – oprava výpočtu „zbývá“

- **Opravena chyba, kdy nová půjčka hned ukazovala o jednu splátku méně.**
  Dřív aplikace u nové půjčky (např. 120 000 Kč, 10 000 Kč měsíčně) automaticky
  považovala první měsíc za zaplacený a rovnou zobrazila „zbývá 110 000 Kč“.
  Příčinou byl odhad zaplacené částky podle počtu měsíců od začátku (`elapsed + 1`),
  který se pletl se skutečnými platbami.
- **Nový, předvídatelný model:** `zbývá = celková částka − skutečně zaznamenané splátky`.
  Nová půjčka začíná na 0 zaplaceno → zbývá celá částka. Kolik je splaceno se mění
  jedině tím, že platbu sám zaznamenáš (tlačítky níže). Žádné dopočítávání podle kalendáře.
- Pole **„Už splaceno“** teď funguje jako živý údaj o zaplacené částce – u rozjeté
  půjčky do něj zadáš, kolik už máš zaplaceno; u nové ho necháš na 0.

## Splátkový kalendář – nová funkce: mimořádná splátka

- U každé nesplacené položky přibylo tlačítko **„+ mimořádná“** vedle „+ splátka“.
- Otevře dialog, kde zadáš libovolnou částku mimořádné splátky (nad rámec běžné
  měsíční). Částka se přičte ke splacenému, sníží zbývající dluh a **posune měsíc
  konce dřív** (počet zbývajících měsíců i projekce konce se přepočítají).
- Mimořádná splátka nemůže přeplatit dluh (automaticky se ořízne na aktuální „zbývá“).

## Drobnosti

- Měsíc konce se počítá jako projekce od pozdějšího z (počátek půjčky / aktuální měsíc),
  takže reaguje na mimořádné splátky i na to, jestli jsi napřed nebo pozadu.
- Aktualizovaná nápověda (ikona „i“) u splátkového kalendáře popisuje nové chování.
