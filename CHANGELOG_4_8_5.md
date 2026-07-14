# LifeHub 4.8.5 – změny

## Opravená výplata v Přehledu

- Měsíční finanční plán načítá výplatu také přímo z výplatní pásky podle data připsání.
- Starší páska bez propojené mzdové transakce už nezobrazuje 0 Kč.
- Při odemčení se chybějící nebo neúplná mzdová transakce automaticky doplní a propojí.
- Starší odhadované datum vedené omylem ve stejném měsíci jako mzdové období se opraví na standardní výplatní den následujícího měsíce.
- Stejná mzda se nezapočítá dvakrát z pásky i transakce.

## Celá obrazovka

- Horní tlačítko nyní používá skutečné Fullscreen API.
- Stav tlačítka reaguje také na ukončení fullscreen režimu systémovým gestem.
- Pokud telefon skutečný fullscreen nepovolí, LifeHub zapne záložní rozšířený režim a zobrazí upozornění.

## Automatické biometrické odemčení

- Je-li rychlé odemčení na zařízení aktivní, LifeHub po otevření automaticky vyvolá systémový dialog otisku, obličeje, PINu nebo zámku telefonu.
- Automatické ověření se spustí také po ručním nebo automatickém zamknutí aplikace.
- Ruční biometrické tlačítko zůstává dostupné jako záložní možnost.

## Dokumentace a PWA

- Interaktivní manuál je aktualizovaný na 4.8.5.
- Změněna PWA cache, aby telefon načetl nové soubory.
- Doplněny regresní testy pro mzdu, fullscreen a automatickou biometrii.
