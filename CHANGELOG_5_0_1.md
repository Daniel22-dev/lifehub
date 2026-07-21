# LifeHub 5.0.1 – kalkulačka kombinace velkých nákupů

## Hlavní změna

V sekci **Velké nákupy** lze nově zaškrtnout více položek a okamžitě zjistit jejich společnou cenu. Funkce slouží pro rychlé modelování variant, například zda lze současně koupit spotřebič, materiál a vybavení, nebo kterou položku je nutné odložit.

## Jak kalkulačka funguje

- Každá aktivní nebo odložená položka má volbu **Do kombinace**.
- Součet se aktualizuje ihned po zaškrtnutí nebo odškrtnutí.
- Výběr zůstává zachován při vyhledávání, filtrování a změně řazení.
- Tlačítko **Vybrat zobrazené** označí všechny aktuálně zobrazené nekoupené položky.
- Vybrané položky jsou vidět v souhrnu a lze je odtud jednotlivě odebrat.
- Tlačítko **Zrušit výběr** vyčistí celou modelovou kombinaci.
- Položka bez ceny zůstane ve výběru, ale LifeHub upozorní, že není zahrnuta do celkového součtu.
- Koupené položky nelze do kombinace přidat; při označení položky jako koupené se automaticky z výběru odstraní.

## Ukládání a bezpečnost

Kombinace je pouze dočasný pracovní propočet. Nemění strukturu šifrovaných dat, neukládá se do zálohy a při zamknutí nebo novém načtení LifeHubu se vyčistí. Stávající nákupy, projekty, finance i všechny ostatní moduly zůstávají beze změny.

## Kontrola vydání

Vydání prošlo úplnou kontrolou `npm run check`:

- ESLint,
- syntaktická kontrola,
- kontrola citlivých dat,
- 115 automatických testů,
- smoke test,
- produkční Vite build.
