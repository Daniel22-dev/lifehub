# LifeHub 4.0.0

LifeHub je lokální osobní PWA pro poznámky, finance, výplatní pásky, úkoly, nákupy, splátky, přehled aplikací a šifrovaný archiv dokumentů.

## Stav projektu

**Verze 4.0 je připravena jako oficiální osobní nástroj pro běžný provoz.** Není označena jako pilot. Má produkční build, automatické testy, GitHub Actions, šifrované lokální ukládání, transakční obnovu záloh a dokumentovaný provozní postup.

Toto vymezení platí pro jednoho uživatele a lokální data v prohlížeči. LifeHub není cloudová služba, týmový systém, správce hesel ani náhrada profesionálně auditovaného DMS. Telefon a PC mají samostatný trezor a data se mezi nimi přenášejí ručně kompletní šifrovanou zálohou.

## Hlavní vlastnosti 4.0

- AES-GCM šifrování stavu, PDF a dokumentů; klíč se odvozuje z hesla pomocí PBKDF2-SHA256.
- Bezpečná změna hesla, která znovu zašifruje stav i soubory.
- Obnova po přerušené změně hesla nebo kompletním importu.
- Kompletní šifrovaná záloha včetně souborů a lehčí datová záloha bez souborů.
- Přísná kontrola formátu, skutečné velikosti, duplicit a vazeb souborů při importu.
- Transakční výměna obsahu IndexedDB: neúspěšný soubor nesmaže původní archiv napůl.
- Ověření zálohy bez importu, náhled před přepsáním a potvrzení slovem `IMPORTOVAT`.
- Automatické zamknutí po neaktivitě a kontrola skutečně uplynulého času po návratu do aplikace.
- PWA pro GitHub Pages s bezpečnou aktualizací bez vynuceného reloadu rozpracovaného formuláře.
- Jednotkové testy a statický smoke test spouštěné lokálně i v CI.

## Struktura

```text
index.html
src/
  app/lifehub-app.js
  config/constants.js
  core/ui.js
  core/utils.js
  features/backup.js
  features/backup-validation.js
  features/finance.js
  pwa/register-sw.js
  security/crypto.js
  storage/indexed-db.js
  styles/lifehub.css
public/
  manifest.json
  sw.js
  icon.svg
  icon-192.png
  icon-512.png
  vendor/pdf.min.mjs
  vendor/pdf.worker.min.mjs
tests/
  backup-validation.test.mjs
  crypto.test.mjs
  finance.test.mjs
  utils.test.mjs
scripts/check-smoke.mjs
docs/AUDIT_SOL_4_0.md
docs/PROVOZNI_POSTUP.md
.github/workflows/
  ci.yml
  deploy.yml
```

## Lokální spuštění

```bash
npm ci
npm run dev
```

## Úplná kontrola projektu

```bash
npm run check
```

Příkaz postupně provede kontrolu syntaxe, jednotkové testy, smoke test a produkční build.

## GitHub Pages

1. Nahraj obsah projektu do kořene repozitáře.
2. V **Settings → Pages** nastav zdroj **GitHub Actions**.
3. Push do větve `main` spustí `.github/workflows/deploy.yml`.
4. Workflow provede `npm ci`, testy, smoke test a build.
5. Publikuje se pouze výstup `dist` vytvořený během workflow.

`vite.config.js` v GitHub Actions nastaví `base` podle názvu repozitáře. Pro vlastní doménu nebo zvláštní cestu lze použít proměnnou `LIFEHUB_BASE`.

## Soukromí a zálohy

Do repozitáře nepatří PDF, osobní dokumenty, exporty ani zálohy. `.gitignore` blokuje běžné citlivé formáty; před commitem je přesto nutné zkontrolovat seznam souborů.

Doporučený provoz:

1. Hlavní zařízení zálohuj kompletní šifrovanou zálohou alespoň jednou týdně a před větší aktualizací.
2. Novou zálohu občas ověř funkcí **Ověřit zálohu bez importu**.
3. Před importem na druhém zařízení vytvoř jeho aktuální kompletní zálohu.
4. Po obnově zkontroluj počet dokumentů, PDF výplatních pásek a datum poslední obnovy.
5. Heslo trezoru ani heslo zálohy nelze obnovit. Uchovávej je mimo LifeHub.

Podrobnosti jsou v `docs/PROVOZNI_POSTUP.md` a výsledek auditu v `docs/AUDIT_SOL_4_0.md`.
