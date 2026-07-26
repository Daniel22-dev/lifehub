# LifeHub 5.1.0

## Plány a postupy

- V části **Dům a technika** je nová samostatná záložka **Plány a postupy**.
- Modul **Projekty domu** zůstává beze změny a je nadále určen pro větší rekonstrukce a investice.
- Hotové soubory `.html` a `.htm` lze nahrát, pojmenovat, zařadit do kategorie, připnout, upravit, stáhnout a smazat.
- Kategorie: Zahrada, Topení a energie, Dům, Servis a údržba, Ostatní.
- Interaktivní plán se otevírá v bezpečně odděleném sandboxu bez přístupu k heslu, financím a ostatním datům LifeHubu.
- HTML soubory se ukládají šifrovaně v IndexedDB a jsou součástí kompletní šifrované zálohy.

## Plátce výdajů

- Výdaje lze označit jako **Já** nebo **Manželka**.
- Volba je dostupná u ručních výdajů, účtů a závazků, splátek, Velkých nákupů, jídla a benzínu, zahradních nákupů, zahradní údržby a servisu domácnosti.
- U opakovaných účtů a splátek se ukládá výchozí plátce; konkrétní ruční úhrada může mít jiného plátce.
- Výdaj zaplacený manželkou zůstává součástí nákladů domácnosti, ale nesnižuje osobní zůstatek uživatele.
- Přehled rozlišuje **Zaplatil jsem**, **Zaplatila manželka**, **Můj zůstatek** a **Náklady domácnosti**.
- Finance lze filtrovat podle plátce. Roční graf v režimu manželky nebo celé domácnosti již nesrovnává tyto výdaje s osobní mzdou.
- Starší výdaje se při migraci bezpečně označí jako zaplacené uživatelem, dokud je ručně nepřepne.

## Data a testy

- Datové schéma zvýšeno na verzi 13.
- Kompletní záloha validuje také očekávané HTML soubory plánů.
- Přidány regresní testy pro plátce, osobní zůstatek, HTML plány, sandbox a kompletní zálohu.
