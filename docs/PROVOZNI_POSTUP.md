# LifeHub 4.0 – provozní postup

## První nasazení

1. Nahraj čistý obsah ZIPu do kořene GitHub repozitáře.
2. Zapni GitHub Pages přes GitHub Actions.
3. Po prvním otevření založ trezor heslem dlouhým alespoň 14 znaků.
4. V Nastavení pojmenuj zařízení, například „Telefon“ nebo „PC doma“.
5. Povol trvalejší úložiště, pokud ho prohlížeč nabídne.
6. Vytvoř první kompletní šifrovanou zálohu a ověř ji bez importu.

## Běžný provoz

- Kompletní záloha: jednou týdně, před importem a před větší aktualizací.
- Datová záloha: pro rychlý přenos bez PDF a dokumentů.
- Ověření zálohy: po důležitém exportu nebo alespoň jednou měsíčně.
- Provozní kontrola: po aktualizaci nebo při podezření na problém.
- Heslo: změnit v Nastavení; během změny aplikaci nezavírat.

## Přenos telefon ↔ PC

1. Na zdrojovém zařízení vytvoř kompletní zálohu.
2. Na cílovém zařízení nejprve vytvoř jeho vlastní kompletní zálohu.
3. Zdrojový soubor na cíli ověř bez importu.
4. Zkontroluj datum, typ zálohy, počty položek a počet souborů.
5. Proveď import a napiš `IMPORTOVAT`.
6. Ověř Archiv, výplatní pásky a datum poslední obnovy.

Import není synchronizace. Obsah cílového zařízení se nahrazuje obsahem zálohy.

## Aktualizace aplikace

1. Vytvoř kompletní zálohu hlavního zařízení.
2. Nahraj novou verzi do GitHubu.
3. Po dokončení workflow zavři starou kartu/PWA a otevři aplikaci znovu.
4. Spusť Provozní kontrolu.
5. Ověř, že se zobrazují stará data a soubory.

Service worker nevynucuje reload rozpracované stránky. Nová verze se bezpečně aktivuje po ukončení staré instance.

## Nouzové situace

### Zapomenuté heslo trezoru

Heslo nelze obnovit. Lze pouze nouzově smazat lokální trezor a obnovit data ze zálohy se známým heslem k záloze.

### Import nebo změna hesla byly přerušeny

LifeHub při dalším spuštění zkontroluje interní obnovovací deník. Pokud byla transakce dokončena, dokončí přepnutí na nový stav; pokud nebyla, zachová původní data.

### Chybí dokument nebo PDF

Spusť Provozní kontrolu a zkontroluj kompletní zálohu. Datová záloha přenáší pouze metadata, nikoli fyzické soubory.

### Prohlížeč hlásí nedostatek místa

Stáhni kompletní zálohu, odstraň nepotřebné velké dokumenty a zkontroluj volné místo zařízení. Nečisti data webu pro doménu LifeHubu bez ověřené zálohy.
