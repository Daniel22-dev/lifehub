# LifeHub 3.2 – výpis změn

Vychází z LifeHub 3.1 (modulární Vite build). Verze aplikace: 3.2.0.

## Úvod a orientace
- Po odemčení heslem se zobrazí osobní pozdrav podle denní doby s oslovením (výchozí „Dane“, lze změnit v Nastavení → Jméno pro pozdrav).
- Sjednocená velikost nadpisů ve všech záložkách: název kategorie je největší, podtitul střední, technický/pomocný text nejmenší.
- Technické popisy jednotlivých sekcí se přesunuly do tooltipu (ikona „i“ u nadpisu). Otevře se klepnutím (mobil) i najetím (počítač).
- Na úvodní stránce přibyly rychlé akce: Nový úkol, Nový nákup, Příjem/výdaj, Nová poznámka, Nová splátka.
- Ve všech hlavních sekcích je vpravo dole plovoucí tlačítko „+“ pro rychlé přidání položky dané záložky. Formuláře pro přidání jsou nově sbalené a otevírají se tlačítkem „+“ nebo klepnutím na jejich hlavičku.

## Poznámky
- Poznámky se zobrazují jako první; formulář pro novou poznámku se otevírá přes „+“ vpravo dole.
- Export MD/CSV je přesunut na spodek sekce.
- Novinka: poznámku lze otevřít tlačítkem „Zobrazit“ do čtecího náhledu, který ukáže i celý obsah a shrnutí/prompt (dřív šla jen editace a odkaz).

## Finance
- Jako první se zobrazuje měsíční přehled příjmů, výdajů a bilance.
- PDF čtečka výplatní pásky je sbalená níže (otevře se klepnutím); přidání transakce je přes „+“ vpravo dole.

## To‑do
- Priorita a časový horizont jsou rozdělené na dvě nezávislé osy: Priorita (vysoká/střední/nízká) a Časový horizont (tento týden/měsíc/dlouhodobě).
- Nástěnka řadí úkoly do sloupců podle horizontu a v rámci sloupce podle priority; priorita i horizont jsou vidět jako štítky.
- Oprava: při hledání se zobrazí plochý seznam výsledků, sekce se už „nesekají“.

## Nákupy
- Rozlišení druhu: „Dům / velké nákupy“ vs. „Potraviny“ (u potravin lze zvolit obchod – Lidl, Albert, …).
- Filtr podle druhu; graf a roční plán počítají s velkými nákupy.

## Šifrovaný trezor
- Přidán živý ukazatel využití úložiště (odhad z prohlížeče) a informace o kapacitě.

## Nová sekce: Moje aplikace
- Přehled tvých aplikací; ke každé lze po rozkliknutí přidat samostatné poznámky (tlačítko „+“ vpravo dole).

## Nová sekce: Splátkový kalendář
- Evidence splátek (komu, celková částka, měsíční splátka, od kdy, volitelně už splaceno a den splatnosti).
- Automaticky se dopočítává splacená a zbývající částka, průběh i měsíc konce.
- Tlačítko „+ splátka“ pro zaznamenání další splátky.
- Jednou týdně (při otevření aplikace) se zobrazí přehled zbývajících částek; volitelně jako systémová notifikace (tlačítko „Povolit týdenní notifikace“).

## Datový model a kompatibilita
- Stará data se při odemčení automaticky převedou: úkoly „Nutné“ → vysoká priorita + horizont měsíc; „Tento měsíc“ → střední + měsíc; „Dlouhodobé“ → střední + dlouhodobé. Nákupy dostanou druh „Dům / velké“.
- Nové kolekce `apps` a `installments` jsou součástí záloh (JSON) i exportů (Markdown/CSV).
- Zachována přísná CSP (bez inline stylů/skriptů), dynamické šířky přes utility třídy.
