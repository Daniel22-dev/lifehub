# LifeHub 5.2.0

## Moje Fabia

- Přidána nová hlavní záložka **Moje Fabia** pro Škodu Fabia I, motor 1.2 HTP, rok výroby 2004/2005.
- Každý záznam obsahuje datum, volitelný stav tachometru, typ události, popis, cenu, plátce a volitelnou poznámku.
- Dostupné jsou přesně čtyři typy: Garanční servis, Oprava, STK + emise a Ostatní.
- Úvodní karta zobrazuje aktuální stav tachometru podle nejnovějšího záznamu s kilometry.
- Statistiky ukazují celkové investice, náklady aktuálního roku, poslední garanční servis, poslední STK + emise a počet záznamů.
- Historii lze vyhledávat a filtrovat podle typu a roku; přidán CSV a Markdown export.

## Propojení s financemi

- Přepínač **Započítat do finanční evidence** je u nového záznamu ve výchozím stavu zapnutý.
- Aktivní záznam vytvoří jediný propojený výdaj v kategorii `auto – servis a opravy`.
- Úprava data, ceny, plátce nebo popisu aktualizuje existující transakci a nevytváří duplicitu.
- Vypnutí přepínače odstraní propojený výdaj, ale zachová servisní historii.
- Zpětně doplňované události lze ponechat pouze v historii vozu.
- Ruční odpojení výdaje ve financích zachová zdrojový záznam a zabrání automatickému znovuvytvoření.

## Skutečné cashflow

- Karta **Odhad bilance měsíce** byla nahrazena kartou **Z poslední výplaty zbývá**.
- Finanční cyklus začíná skutečným datem připsání poslední mzdy na účet.
- Do cyklu vstupují všechny další skutečné příjmy a výdaje do dneška; nová výplata otevře nový cyklus.
- Osobní zůstatek odečítá pouze výdaje zaplacené uživatelem. Výdaje manželky zůstávají v nákladech domácnosti.
- Jídlo a benzín jsou zahrnuty do cyklu, měsíčních souhrnů i ročního grafu.
- Roční graf řadí příjmy a výdaje podle skutečného data připsání nebo zaplacení, nikoli podle mzdového období.

## Data a testy

- Datové schéma zvýšeno na verzi 14.
- Migrace bezpečně doplní kolekci `vehicleLogs` bez změny stávajících dat.
- Sanitizace a kontrola unikátních ID zahrnují historii vozu a vazbu `vehicleLogId`.
- Přidány regresní testy pro finanční cyklus, skutečný roční cashflow a modul Moje Fabia.
