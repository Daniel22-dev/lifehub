# LifeHub 5.2.1

## Rodinné sdílení vozu

- Do každého nově vytvořeného šifrovaného rodinného souboru se automaticky zahrne kompletní kolekce `vehicleLogs`.
- Manželka ji po načtení uvidí v části **Rodina** jako panel **Moje Fabia – kompletní historie**.
- Zobrazuje se datum, typ události, tachometr, popis, cena, plátce a poznámka u všech záznamů bez zkrácení seznamu.
- Souhrn panelu ukazuje celkové náklady, poslední stav tachometru, poslední garanční servis a poslední STK + emise.
- Rodinný náhled zůstává pouze ke čtení a neimportuje záznamy do vlastního modulu manželky.
- Propojené finanční transakce z Fabie se do rodinných financí neduplikují; náklady jsou viditelné přímo v historii vozu.
- Rodinné schema zvýšeno z 3 na 4; starší rodinné soubory lze nadále načíst.

## Dokumentace a testy

- Interaktivní manuál aktualizován na verzi 5.2.1.
- Přidány regresní testy exportu, importu, vykreslení a úplnosti historie Fabie.
