# LifeHub – hloubkový audit Sol, verze 4.0

Datum auditu: 10. 7. 2026

## Verdikt

LifeHub 4.0 je **způsobilý k běžnému provozu jako oficiální osobní lokální nástroj**. Původní verze 3.4 měla kvalitní základ, ale několik chyb mohlo při budoucí změně kryptografických parametrů nebo neúspěšném importu způsobit ztrátu přístupu či neúplnou obnovu. Tyto blokující problémy jsou ve verzi 4.0 opraveny.

Verdikt neznamená certifikaci bezpečnosti ani vhodnost pro více uživatelů. Aplikace nebyla podrobena nezávislému penetračnímu testu a stále závisí na ochraně zařízení, prohlížeče a pravidelných zálohách.

## Silné stránky původního řešení

- Dobře zvolená architektura pro osobní použití: statická PWA bez serveru a bez odesílání dat.
- AES-GCM šifrování stavu i souborů, PBKDF2 pro odvození klíče a heslo neuložené v aplikaci.
- Jasné oddělení datové a kompletní zálohy.
- Lokální PDF.js bez externího CDN.
- CSP, bezpečné zpracování URL, escapování dynamického HTML a ochrana CSV před vzorci.
- Vite build, GitHub Actions a postupná modularizace.
- Prakticky navržené sekce odpovídající osobnímu workflow.

## Nalezené zásadní nedostatky a opravy

### 1. Nekonzistence PBKDF2 iterací – kritické

Při odemčení se používal počet iterací uložený v obálce, ale při dalším uložení se do obálky vždy zapsala aktuální konstanta. Po budoucím zvýšení iterací by tak aplikace zašifrovala stav starým klíčem, ale deklarovala nové parametry. Další odemčení by selhalo.

**Oprava:** aplikace si drží skutečný počet iterací odemčeného trezoru a při každém uložení zapisuje přesně tuto hodnotu. KDF parametry mají bezpečný dolní a horní limit.

### 2. Neatomická kompletní obnova – kritické

Původní import nejprve vymazal obě úložiště IndexedDB a potom soubory obnovoval po jednom. Chyba uprostřed mohla zanechat jen část archivu.

**Oprava:** všechny soubory se nejprve validují, dekódují a zašifrují bez zásahu do původních dat. Následně se obě úložiště nahradí v jediné transakci. Importní deník umožní dokončit konzistentní stav i po neočekávaném zavření aplikace.

### 3. Chybějící bezpečná změna hesla – vysoká priorita

Aplikace neuměla změnit heslo bez exportu a nového založení trezoru.

**Oprava:** nová funkce znovu zašifruje stav, PDF i dokumenty. Připravená data se zapíší atomicky a změna má obnovovací deník pro případ přerušení.

### 4. Důvěra deklarované velikosti souboru – vysoká priorita

Import mohl sečíst údaj `size` dodaný zálohou, i když Base64 data byla výrazně větší. To otevíralo cestu k vyčerpání paměti.

**Oprava:** kontroluje se skutečná velikost Base64, platnost formátu, deklarovaná shoda, počet souborů, celkový limit, duplicity a vazba každého souboru na metadata.

### 5. Ztráta vazby upraveného mzdového příjmu – střední priorita

Při ruční úpravě transakce vytvořené z výplatní pásky se zahodily `payrollId` a `payrollMonth`. Následné smazání pásky nemuselo odstranit navázaný příjem.

**Oprava:** finanční záznam se vytváří samostatným testovaným helperem a vazbu zachovává.

### 6. Datum přes UTC – střední priorita

Funkce „dnes“ používala ISO datum v UTC. V českém časovém pásmu mohla kolem půlnoci vrátit předchozí nebo následující den.

**Oprava:** datum a měsíc se skládají z místních kalendářních hodnot.

### 7. Automatické zamknutí po návratu – střední priorita

Po návratu ze skryté karty se časovač pouze restartoval, takže dlouho opuštěná odemčená aplikace mohla zůstat otevřená dalších 15 minut.

**Oprava:** ukládá se čas poslední aktivity a při návratu se kontroluje skutečně uplynulá doba.

### 8. Soubory, které nešly kompletně zálohovat – střední priorita

Archiv dovoloval uložit soubor větší než limit jednoho souboru v kompletní záloze.

**Oprava:** stejný limit je vynucen už při uložení a kontroluje se dostupná kapacita úložiště.

### 9. Diagnostika obsahovala identifikující technická data – střední priorita

Export označený jako „bez osobních dat“ obsahoval název zařízení, úplnou základní URL a celý user-agent.

**Oprava:** export uvádí jen informaci, zda je štítek zařízení nastaven, obecný protokol/režim instalace, jazyk a platformu. Neobsahuje zadaný název ani úplný user-agent.

### 10. PWA aktualizace mohla přerušit práci – střední priorita

Service worker volal `skipWaiting()` a registrace po převzetí kontroly stránku automaticky obnovila. To mohlo zahodit neodeslaný formulář.

**Oprava:** nová verze čeká na bezpečný životní cyklus service workeru a aplikace se během rozpracované práce sama nenačte znovu.

## Design a použitelnost

- Mobilní navigace má vodorovné posouvání a zachovává textové popisky; uživatel není odkázán pouze na emoji.
- Stav šifrovaného uložení zůstává na mobilu viditelný v kompaktní podobě.
- Fokus používá `:focus-visible` a má zřetelné ohraničení pro klávesnici.
- Dynamické šířkové třídy 0–100 byly nahrazeny sémantickým prvkem `<progress>`.
- Nastavení obsahuje jasné označení produkčního režimu a přesné vysvětlení hranic lokálního provozu.
- Odstraněna duplicitní položka v nápovědě a sjednoceny texty/verze na 4.0.

## Obsah a informační architektura

Obsahové moduly dávají pro osobní použití smysl a nepřekrývají se zásadním způsobem. Největší hodnotu mají:

- globální hledání napříč osobními daty,
- finance propojené s výplatními páskami,
- archiv dokumentů,
- úkoly/nákupy/splátky,
- přehled vlastních aplikací,
- kompletní přenos mezi zařízeními bez cloudu.

Verze 4.0 přesněji rozlišuje datum vytvoření zálohy, datum jejího ověření a datum poslední obnovy.

## Automatické ověření

Projekt obsahuje:

- kontrolu syntaxe všech modulů,
- 8 jednotkových testů,
- statický smoke test produkčních vazeb,
- produkční Vite build,
- CI i deploy workflow se stejnými kontrolami.

Testy kryjí místní datum, CSV ochranu, vazbu mzdové transakce, Base64 velikost, validaci souborů zálohy a hranice KDF.

## Zbývající hranice

- Hlavní aplikační controller je stále velký. Není to blokátor provozu, ale další funkce je vhodné přidávat do samostatných modulů, nikoli dál zvětšovat `lifehub-app.js`.
- Ruční přenos nemá slučování konfliktů. Import vždy nahrazuje stav cílového zařízení.
- Prohlížeč nebo operační systém může lokální data odstranit. Kompletní záloha je povinná provozní pojistka.
- Odemčená aplikace může být čtena škodlivým softwarem běžícím pod uživatelským účtem; šifrování chrání primárně data uložená v klidu.
- Výplatní PDF bez textové vrstvy vyžaduje OCR mimo aplikaci.

## Akceptační závěr

Pro osobní lokální použití jsou splněny podmínky profesionální verze: konzistentní šifrování, bezpečné ukládání, zálohování a obnova, ochrana destruktivních operací, použitelný mobilní design, dokumentace, automatické testy a reprodukovatelné nasazení.
