# LifeHub 4.5.1 – provozní postup

## První nasazení

1. Přečti `BEZPECNE_NASAZENI_4_4.md`, zejména pokud mohl být starší citlivý soubor někdy zveřejněn v historii GitHubu.
2. Nahraj čistý obsah ZIPu do kořene repozitáře.
3. Zapni GitHub Pages přes GitHub Actions.
4. Po prvním otevření založ trezor heslem dlouhým alespoň 14 znaků.
5. V Nastavení pojmenuj zařízení a zvol, zda mají systémové notifikace skrývat částky a jména věřitelů.
6. Vytvoř první kompletní šifrovanou zálohu a ověř ji bez importu.

## Běžný provoz

- Kompletní záloha: jednou týdně, před importem, změnou hesla a větší aktualizací.
- Datová záloha: pro rychlý přenos bez PDF a dokumentů.
- Ověření zálohy: po důležitém exportu nebo alespoň jednou měsíčně.
- Rodinný soubor: před exportem zkontroluj zobrazený souhrn zahrnutých kategorií.
- Heslo: měň pouze po vytvoření ověřené kompletní zálohy.

## Stav ukládání

Horní lišta rozlišuje stav `Šifruji`, `Neuloženo`, `Uložení selhalo` a čas posledního úspěšného uložení.

Při selhání uložení LifeHub citlivý obsah skryje, ale ponechá aktuální data v paměti. Nabídne:

1. zopakovat uložení,
2. stáhnout nouzovou šifrovanou datovou zálohu,
3. změny výslovně zahodit a zamknout.

Automatický zámek nikdy nesmí potichu zahodit stav, který se nepodařilo uložit.

## Přenos telefon ↔ PC

1. Na zdrojovém zařízení vytvoř kompletní zálohu.
2. Na cílovém zařízení nejprve vytvoř jeho vlastní kompletní zálohu.
3. Zdrojový soubor na cíli ověř bez importu.
4. Zkontroluj datum, typ zálohy, počty položek a počet souborů.
5. Proveď import a napiš `IMPORTOVAT`.
6. Ověř Archiv, výplatní pásky a datum poslední obnovy.

Na mobilu platí konzervativnější velikostní limit. Příliš velkou kompletní zálohu obnov na počítači.

## Aktualizace aplikace

1. Vytvoř kompletní zálohu hlavního zařízení.
2. Nahraj novou verzi do GitHubu.
3. Po dokončení workflow zavři starou kartu/PWA a otevři aplikaci znovu.
4. Spusť Provozní kontrolu.
5. Ověř číslo verze, stará data, archiv a poslední zálohu.

Service worker nevynucuje reload rozpracované stránky. Novou verzi aktivuje bezpečný životní cyklus PWA.

## Nouzové situace

### Zapomenuté heslo trezoru

Heslo nelze obnovit. Lze pouze smazat lokální trezor a obnovit data ze zálohy se známým heslem.

### Uložení selhalo

Nezavírej kartu. Nejdříve použij `Zkusit uložit znovu`; pokud to nepomůže, stáhni nouzovou šifrovanou zálohu. Teprve potom zvaž zahození změn.

### Import nebo změna hesla byly přerušeny

LifeHub při dalším spuštění zkontroluje obnovovací deník. Dokončí připravený konzistentní stav, nebo zachová původní data.

### Chybí dokument nebo PDF

Neúplná záloha se ve 4.5.1 nevydává za kompletní. Spusť Provozní kontrolu a použij poslední ověřenou kompletní zálohu.

### Prohlížeč hlásí nedostatek místa

Stáhni kompletní zálohu, odstraň nepotřebné velké dokumenty a zkontroluj volné místo zařízení. Nečisti data webu pro doménu LifeHubu bez ověřené zálohy.
