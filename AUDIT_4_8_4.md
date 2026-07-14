# Audit LifeHub 4.8.4 – finance a splátky

Bylo ověřeno propojení splátkového kalendáře s finanční evidencí a nový souhrn na záložce Přehled.

Souhrn odděluje skutečně připsanou výplatu, již utracené částky a výdaje, které v aktuálním měsíci ještě čekají. Zahrnuje finanční transakce, jídlo a benzín, neuhrazené závazky, pravidelné splátky a zbývající měsíční rozpočet. Splátky s budoucím počátečním měsícem se předčasně nezapočítávají.

Běžné a mimořádné splátky vytvářejí propojené finanční výdaje. Starší historie se bezpečně dorovnává a odpojený záznam se znovu nevytváří.

Kontroly:

- syntaxe zdrojových souborů: v pořádku,
- kontrola citlivých dat: v pořádku,
- automatické testy: 74/74,
- smoke test PWA a verzí: v pořádku,
- produkční sestavení Vite: v pořádku,
- syntaxe interaktivního manuálu: v pořádku.
