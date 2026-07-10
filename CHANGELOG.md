# LifeHub changelog

## v4.0.0 – produkční osobní verze

- Opravena kritická konzistence PBKDF2 iterací při uložení odemčeného trezoru.
- Přidána bezpečná změna hesla včetně přešifrování PDF a dokumentů.
- Přidány obnovovací deníky pro přerušenou změnu hesla a kompletní import.
- Kompletní import nejprve validuje a připraví všechny soubory, poté nahradí obě IndexedDB úložiště v jediné transakci.
- Import kontroluje skutečnou Base64 velikost, formát, duplicity, vazby na metadata a celkový limit.
- Opraveno místní datum místo UTC a zachování vazby transakce na výplatní pásku.
- Sjednocen limit souboru archivu s limitem kompletní zálohy a přidána kontrola volné kapacity.
- Automatické zamknutí po návratu kontroluje skutečnou dobu neaktivity.
- Diagnostika již neexportuje název zařízení, úplnou URL ani celý user-agent.
- Mobilní navigace zachovává textové popisky; stav uložení zůstává viditelný.
- Grafické ukazatele používají přístupný prvek `progress`; odstraněno 101 pomocných CSS tříd.
- Service worker již nevynucuje reload rozpracované aplikace.
- Přidáno 8 jednotkových testů, společný příkaz `npm run check` a testovací krok v CI/deploy workflow.
- Doplněn produkční manifest, provozní dokumentace a auditní zpráva.

## v3.4.0 – osobní bezpečnost a přenos telefon ↔ PC

- Přidáno ověření zálohy bez importu: soubor se načte/dešifruje, zobrazí se počty položek a počet přibalených souborů, ale aktuální trezor se nepřepíše.
- Import má další bezpečnostní pojistku: po náhledu je nutné napsat `IMPORTOVAT`.
- Náhled importu a ověření zálohy upozorní, když je importovaný soubor starší než aktuální stav zařízení.
- V sekci Zálohy přibyl průvodce přenosem telefon ↔ PC.
- Stav záloh nově ukazuje i poslední ověření zálohy a stáří kompletní zálohy.
- Doplněn diagnostický export bez osobních dat: verze, počty položek, stav úložiště, IndexedDB příznaky, service worker a Web Crypto – bez textů poznámek, částek, názvů souborů nebo obsahu dokumentů.
- Vylepšené mobilní ovládání pro ověření/import zálohy a delší potvrzovací dialogy.

## v3.3.1 – bezpečnější import a ochrana stávajících souborů

- Opravena ochrana stávajících dat po aktualizaci: při odemčení se zachovávají příznaky uložených PDF/dokumentů a aplikace je navíc porovná se skutečnými záznamy v IndexedDB.
- Před každým importem aplikace nabídne stažení aktuální kompletní zálohy tohoto zařízení. Import lze bezpečně zrušit nebo pokračovat bez zálohy.
- Import teď zobrazuje náhled „aktuální zařízení vs. importovaný soubor“ včetně počtů poznámek, transakcí, výplatních pásek, dokumentů, úkolů, nákupů, aplikací a splátek.
- Do nastavení přibyl „Název zařízení“ a exporty nesou metadata: zařízení, datum exportu, verze LifeHubu a typ exportu.
- Nešifrovaný JSON export nově používá kompatibilní obal s metadaty; import starších čistých JSON stavů dál funguje.
- Dokumenty bez fyzického souboru z datového importu se v archivu zobrazí jako „jen metadata, soubor chybí“, aby nebyly zaměněny za skutečně uložené soubory.

## v3.3.0 – kompletní záloha pro telefon ↔ PC

### Priorita A
- Přidána kompletní šifrovaná záloha včetně PDF výplatních pásek a dokumentů z IndexedDB.
- Původní šifrovaná JSON záloha je v UI jasně pojmenovaná jako šifrovaná datová záloha bez souborů.
- Import rozlišuje datovou zálohu a kompletní zálohu. Kompletní import obnoví soubory do IndexedDB a nastaví metadata podle skutečně obnovených souborů.
- Doplněn `.gitignore` proti nechtěnému nahrání soukromých exportů, PDF, dokumentů, CSV a ZIPů do veřejného GitHubu.
- Doplněn `package-lock.json`; GitHub Actions používají `npm ci`.
- Manifest PWA už nese neutrální název `LifeHub` bez zastaralé verze 3.1.

### Priorita B
- Přidán statický smoke test `npm run check:smoke`, který kontroluje zapojení kompletní zálohy, importu, manifestu, workflow a `.gitignore`.
- CI a Deploy workflow nyní spouští syntax check, smoke check a až potom build.
- Další opatrná modularizace: IndexedDB operace jsou přesunuty do `src/storage/indexed-db.js`, obecné backup helpery do `src/features/backup.js`.
- V sekci Zálohy přibyl stav poslední datové a kompletní zálohy.

### Priorita C
- Uklizen kořen repozitáře: odstraněny zastaralé kopie ikon a starý root CSS soubor.
- Starší poznámky a changelogy byly přesunuty do `docs/archive/`.
- Sekce Export byla přejmenována na Zálohy / Export a texty jasně rozlišují datovou zálohu, kompletní zálohu a exporty pro Notion/sdílení.
- Do nápovědy přidán praktický postup pro telefon jako hlavní zařízení a PC jako druhé zařízení.
