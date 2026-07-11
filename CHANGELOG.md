# Changelog

## v4.3.3 – interaktivní manuál přímo v LifeHubu

- Kompletní interaktivní manuál je nově součástí aplikace a instalačního balíčku.
- Položka **Nápověda** byla změněna na **Manuál** a zobrazuje celého průvodce přímo uvnitř LifeHubu.
- Do horní lišty přibylo tlačítko `❔` pro okamžité otevření manuálu.
- Manuál lze také otevřít v samostatném okně na celou obrazovku.
- Obsahuje vyhledávání, mapu všech 17 částí, pracovní scénáře, rodinný náhled, zálohy, bezpečnost, FAQ a checklist.
- Soubor `manual.html` je uložen v PWA cache a funguje offline.
- Manuál je oddělený od šifrovaného trezoru a nečte žádná osobní data.

# LifeHub changelog

## v4.3.2 – rodinné heslo pouze jednou

- Rodinné heslo se po prvním zadání ukládá uvnitř šifrovaného trezoru konkrétního zařízení.
- Vytvoření i načtení rodinného souboru používá uložené heslo automaticky; běžné 15minutové zamknutí LifeHubu ho nemaže ani znovu nevyžaduje.
- Pokud uložené heslo neodpovídá přijatému souboru, LifeHub umožní zadat správné heslo a po úspěšném odemčení jím nahradí dosavadní.
- V Nastavení lze rodinné heslo bezpečně nastavit, změnit nebo odstranit.
- Rodinné heslo se nikdy nevkládá do rodinného souboru a není součástí partnerského náhledu.
- Nešifrovaná datová záloha uložené rodinné heslo záměrně neobsahuje; přenáší se jen v šifrovaných zálohách.

## v4.3.1 – rodinné sdílení pouze jako náhled

- Rodinný import byl zjednodušen na jediný bezpečný režim: **náhled pouze pro čtení**.
- Odstraněna tlačítka a dialogy pro slučování; načtený soubor nikdy nepřidává, neupravuje ani nemaže vlastní data.
- Novější partnerův soubor nahradí předchozí náhled v záložce Rodina.
- V partnerském náhledu se odpovědnost zobrazuje srozumitelně jako jméno partnera, „Ty“ nebo „Oba“.
- Opravena duplicita panelu rodinných úkolů v náhledu.
- Aktualizována dokumentace, nápověda, testovací smoke check a cache service workeru.

## v4.3.0 – skutečné rodinné sdílení a platby domácnosti

- Rodinný export je nově **šifrovaný společným heslem** a používá vlastní formát `.lifehub-family`.
- Import nabízí náhled nebo bezpečné sloučení. Položky se párují podle stabilního ID a času změny, takže nevznikají zbytečné duplicity.
- Synchronizují se společné finance, limity a útraty Jídlo & benzín, nákupní seznam, rodinné úkoly, velké nákupy, splátky, platby domácnosti a zahrada.
- Přidány synchronizační záznamy smazaných položek, aby se po další výměně nevracely odstraněné záznamy.
- Nová záložka **Platby domácnosti**: jednorázové i pravidelné platby, splatnost, odpovědná osoba, stav, historie úhrad a automatický posun dalšího termínu.
- Splátky nově evidují historii běžných a mimořádných plateb a zobrazují, kdo je má řešit a zda jsou sdílené.
- U transakcí, úkolů, nákupů, splátek a zahrady lze určit, zda jsou společné nebo soukromé; u úkolů, splátek a plateb také odpovědnou osobu.
- Výplatní pásky, dokumenty, poznámky, AI výkaz, odměny a přehled aplikací zůstávají mimo rodinný export.
- Přidán modul `family-sync.js` a jednotkové testy slučování, tombstonů a termínů opakovaných plateb. GitHub workflow nyní spouští kompletní `npm run check`.

## v4.2.0 – zahrada, rodina a spolehlivé pásky

- Nová záložka **Zahrada**: seznam věcí k pořízení (odkaz, odhad ceny, horizont pořízení, komentář, odškrtnutí „mám") a deník údržby – hnojení podle částí zahrady, vertikutace, aerifikace, dosev, postřik, sekání, zásahy na závlaze a servis techniky. Přehled „kdy naposledy" ukazuje u každého typu poslední datum a stáří záznamu.
- Nová záložka **Rodina**: partner ve svém LifeHubu vytvoří „Sdílení pro partnera" (JSON s nákupním seznamem, úkoly, velkými nákupy, splátkami a zahradou – bez financí, pásek, dokumentů a poznámek) a druhá strana ho načte jako náhled jen pro čtení pod jeho jménem. Nekoupené položky partnerova nákupního seznamu lze jedním klepnutím převzít do vlastního seznamu (duplicitní se přeskočí).
- **Opravené čtení výplatních pásek**: pásky ze systému Elanor mají souhrn ve čtyřech sloupcích „popisek hodnota" na jednom řádku, takže původní obecný parser našel prakticky jen hrubou mzdu. Nový modul `payroll-elanor.js` páruje každý popisek s hodnotou hned za ním, čte i položkové řádky (náhrady při nemoci, příplatky, stravenky, srážky, DPP) a automaticky předvyplní měsíc, zaměstnavatele i poznámku. Čistá mzda se ukládá jako dobírka (částka na účet). Ověřeno na reálné pásce, pokryto jednotkovými testy.
- **Hromadný import pásek z JSON** (tlačítko v kartě výplatních pásek): přidá pásky k současným datům včetně zápisu do příjmů, existující měsíce přeskočí, nic nenahrazuje. V `docs/vyplatni-pasky-2026-01-az-06.json` jsou připravené ručně vytěžené pásky leden–červen 2026.
- **Roční přehled velkých nákupů** nahradil SVG graf: po měsících ukazuje plán i skutečně koupené s počty položek a upozorní, kolika položkám chybí odhad ceny. Odstraněn pozůstatek přepínače dům/obchod, který mohl shodit start aplikace.

## v4.1.0 – rozpočet, výkazy a nový nákupní seznam

- Nová záložka **Jídlo & benzín**: dvě měsíční obálky (výchozí limity 10 000 Kč / 3 500 Kč, upravitelné), čerpání limitů, bilance plus/mínus a roční graf s bilanční křivkou. Evidence je oddělená od záložky Finance.
- Nová záložka **AI výkaz**: zápis činností s časem v minutách, roční graf, uzavření/otevření měsíce a generování měsíčního výkazu pro vedení – PDF přes tiskový dialog (bez externích knihoven, v souladu s CSP) nebo stažení jako HTML.
- Nová záložka **Odměny**: položky (činnost + hodiny) členěné podle období léto / konec roku, editovatelné, s tiskovým dokumentem „Podklady pro odměny“ pro každé období.
- Nová záložka **Nákupní seznam**: rychlý zápis „co a kde“ se seskupením podle obchodu, hromadné vložení zkopírovaného textu (každý řádek = položka) a šifrované ukládání screenshotů seznamů (automatické zmenšení obrázku, uložení do trezoru, přenos kompletní zálohou, náhledy a zobrazení v plné velikosti).
- Záložka Nákupy přejmenována na **Velké nákupy** a zbavena přepínače dům/obchod; staré položky potravin se při odemčení i importu automaticky přesunou do Nákupního seznamu.
- **Dlužná částka splátek se zobrazí při každém odemčení aplikace**; týdenní připomínka nově posílá jen systémovou notifikaci (bez duplicitního hlášení).
- Import/zálohy: sanitizace a počty položek rozšířeny o všechny nové kolekce, CSV a Markdown exporty pro rozpočet, nákupní seznam, AI výkaz i odměny, nová kategorie dokumentů „Nákupní seznam“.
- Nový modul `src/features/budget.js` s čistými funkcemi a jednotkovými testy (`tests/budget.test.mjs`).

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
