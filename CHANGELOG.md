## 5.0.6

- Karta **Už utraceno** na Přehledu je klikací a zobrazuje úplný seznam položek započtených do aktuálního měsíce.
- Rozpis zahrnuje ruční výdaje, účty a faktury, splátky, Velké nákupy, zahradní nákupy, zahradní údržbu, servis domácnosti i jídlo a benzín.
- Každá položka zobrazuje částku, datum, zdroj a tlačítko pro otevření příslušného modulu.
- Příjmy jsou zobrazeny zeleně, výdaje červeně a výsledná bilance podle znaménka.

## 5.0.4

- Zahradní nákupy se po zaškrtnutí přesunou do archivu Pořízeno a jejich cena se automaticky zapíše do výdajů aktuálního měsíce.
- Před přesunem se stejně jako u Velkých nákupů zobrazí fajfka a krátké zelené potvrzení.
- Zadané ceny zahradní údržby a domácího servisu se automaticky zapisují do výdajů podle uvedeného data.
- Úprava a smazání zdrojového záznamu bezpečně aktualizují nebo odstraní propojený výdaj; výdaj lze také samostatně odpojit.
- Finance mají nové filtry a štítky pro zahradní nákupy, zahradní údržbu a servis.

## 5.0.3

- Po zaškrtnutí „Označit jako koupené“ zůstane karta ještě 650 ms na místě, aby byla vidět fajfka a zelené potvrzení.
- Stav nákupu a propojený finanční výdaj se uloží okamžitě; odložený je pouze vizuální přesun položky do archivu koupených.
- Zaškrtávací políčko je větší a lépe čitelné na telefonu i počítači.
- Animace respektuje systémové nastavení omezeného pohybu.

## 5.0.2

- Ve Velkých nákupech je u každé položky přímé zaškrtnutí „Označit jako koupené“.
- Při označení se použije aktuální datum a cena položky se automaticky vytvoří jako propojený výdaj v Příjmech a výdajích.
- Úprava názvu, ceny nebo kategorie koupeného nákupu aktualizuje i propojený výdaj.
- Vrácení položky do plánu odstraní automaticky vytvořený výdaj.
- Výdaj lze ve financích odpojit bez změny stavu nákupu.
- Koupené nákupy se v ročním přehledu řadí podle skutečného data nákupu.

## 5.0.1

- Do sekce **Velké nákupy** byla přidána kalkulačka kombinace.
- Aktivní i odložené položky lze jednotlivě zaškrtávat a okamžitě vidět jejich společnou cenu.
- Výběr zůstává zachován při vyhledávání, filtrování a změně řazení, takže lze skládat kombinace napříč kategoriemi.
- Tlačítko **Vybrat zobrazené** přidá všechny aktuálně zobrazené nekoupené položky.
- Vybrané položky lze odebrat přímo ze souhrnu nebo celý výběr jedním tlačítkem zrušit.
- Položky bez ceny zůstávají ve výběru, ale LifeHub výslovně upozorní, že nejsou započítány do součtu.
- Kalkulačka nemění uložená data a při zamknutí či novém načtení aplikace se vyčistí.

## 5.0.0

- Přidána záložka **Projekty domu** pro rozsáhlejší rekonstrukce a investice.
- Každý projekt má stav, prioritu, oblast, termíny, zadání, požadavky a tagy.
- Položkový rozpočet sleduje materiál, práci, technologie, dopravu, nabídky, objednávky a skutečně zaplacené částky.
- Projekt obsahuje poznámky a odkazy na ChatGPT, Claude, Gemini, weby, e-shopy a dodavatele.
- Obrázky, PDF, dokumenty, tabulky a vlastní kreslené náčrty se ukládají šifrovaně.
- Projekt lze exportovat do Markdownu a rozpočet do CSV.
- Kompletní šifrovaná záloha nově přenáší a ověřuje také všechny projektové přílohy.
- Datové schema bylo bezpečně zvýšeno na verzi 10; starší data zůstávají zachována.

## 4.9.1

- Splátkový kalendář nyní po dosažení nastaveného dne splatnosti automaticky zaznamená běžnou měsíční splátku.
- Automaticky se sníží zbývající dluh i počet zbývajících plateb a vytvoří se propojený výdaj v Příjmech a výdajích.
- Při delší době bez otevření aplikace se bezpečně doplní všechna splatná období od nastaveného začátku; stejné období se nikdy nezapočítá dvakrát.
- Den splatnosti 29.–31. se v kratším měsíci použije jako poslední kalendářní den daného měsíce.

## 4.9.0

- nová záložka **Elektřina – Marek** s poznámkami, nápady, materiálem, cenami a PDF podkladem pro elektrikáře,
- nová záložka **Servis domácnosti** pro kotle, spotřebiče, filtry, revize, komín, klimatizaci a žumpu,
- cena u servisních a údržbových záznamů na zahradě,
- rozšířené exporty CSV, globální vyhledávání, šifrované zálohy a rodinný náhled.

# Changelog

## v4.8.6 – bezpečná migrace, správná mzda, výkaz a odolnější offline režim

- Opravena kritická chyba migrace starších nešifrovaných dat způsobená chybějící funkcí `merge()`. Nečitelný nebo neplatný stav nyní migraci zastaví před zápisem a původní data ponechá beze změny.
- Přidána statická kontrola ESLint; `npm run check` nyní začíná lintem.
- Osmimegabajtový limit zůstal pouze pro cizí importy. Vlastní autentizovaný dešifrovaný trezor už jím není blokován.
- Měsíční výkaz nastavuje dynamické CSS proměnné přes CSSOM a má bezpečné fallbacky, takže funguje pod stávající přísnou CSP.
- Hrubá mzda se už nikde nevydává za částku připsanou na účet. Oprava pokrývá Přehled, importy, nové mzdové transakce, odhady i opravu starších záznamů.
- Instalace service workeru toleruje selhání nepovinných souborů; navigace má třísekundový fallback na cache.
- Odstraněn mrtvý modul `family-sync.js`, nepoužité funkce a nereferencované duplicitní soubory.
- Verze, manuál, testy a cache service workeru byly sjednoceny na 4.8.6.

## v4.8.5 – výplata ze starších dat, skutečný fullscreen a automatická biometrika

- Měsíční plán na Přehledu načte výplatu přímo z výplatní pásky podle data připsání, i když ve starších datech chybí propojená mzdová transakce.
- Při odemčení aplikace se chybějící mzdová transakce automaticky vytvoří nebo opraví, takže se částka propíše také do Příjmů a výdajů.
- Ochrana proti dvojímu započtení zajišťuje, že stejná mzda není sečtena zároveň z pásky i z propojené transakce.
- Tlačítko v horní liště používá skutečné Fullscreen API; pokud jej telefon odmítne, aktivuje se viditelný záložní rozšířený režim.
- Stav tlačítka se synchronizuje i při ukončení celé obrazovky systémovým gestem.
- Aktivované rychlé odemčení se po otevření nebo opětovném zamknutí LifeHubu spustí automaticky. Ruční tlačítko zůstává jako záložní možnost.
- Interaktivní manuál byl kompletně aktualizován pro všechny změny 4.8.5.

## v4.8.4 – skutečný měsíční finanční souhrn a propojené splátky

- Přehled obsahuje nový blok **Výplata vs. všechny aktuální a plánované výdaje**.
- Souhrn spojuje připsanou výplatu, již provedené finanční výdaje, jídlo a benzín, neuhrazené účty a faktury, trvalé příkazy, splátky a zbývající měsíční rozpočet.
- Ukazatel **Po všech výdajích** zobrazuje, kolik z připsané výplaty zbude po skutečných i očekávaných výdajích daného měsíce.
- Tlačítka **+ splátka** a **+ mimořádná** nově automaticky vytvářejí propojený výdaj v záložce Příjmy a výdaje.
- Při prvním otevření se do financí bezpečně doplní také starší zaznamenané splátky; shodný ruční výdaj se přednostně propojí, aby se omezily duplicity.
- Smazání splátkového kalendáře odstraní i jeho propojené finanční záznamy; jednotlivý výdaj lze odpojit bez ztráty historie splátky.
- Opravena syntaktická chyba interaktivního manuálu 4.8.3.

## v4.8.3 – kompletně aktualizovaný interaktivní manuál

- Manuál odpovídá biometrickému odemčení, rodinnému jménu a klikacím URL.
- Popsáno propojení účtů s Příjmy a výdaji, mzdové období a datum připsání.
- Opraven popis prémiového AI výkazu bez živého mobilního náhledu.
- Doplněna dvě období odměn a všechny archivy dokončených položek.
- Popsáno zahrnutí aktivních měsíčních splátek do KPI Měsíční závazky.

## v4.8.2 – čisté aktivní seznamy a archivy

- Dokončené úkoly se v běžném zobrazení přesouvají do rozbalovacího archivu a lze je odškrtnutím vrátit zpět.
- Velké nákupy zobrazují nahoře pouze plánované položky; koupené a odložené mají vlastní rozbalovací archivy.
- Koupené i odložené velké nákupy lze jedním tlačítkem vrátit do aktivního plánu.
- Doplacené splátkové kalendáře se přesouvají do archivu a lze je bezpečně znovu otevřít se zadanou zbývající částkou.
- Mobilní rozložení archivních akcí bylo upraveno pro pohodlné ovládání palcem.

## v4.8.1 – finální mobilní verze a prémiový pracovní výkaz

- Měsíční pracovní výkaz z LifeHubu má nový barevný profesionální design pro vedení školy.
- V záhlaví je vloženo oficiální černobílé logo Gymnázia Ostrava-Hrabůvka a úplný název školy.
- Výkaz zobrazuje přesně jednotlivé činnosti, poznámky, dílčí časy, jejich podíly a celkový vykázaný čas.
- HTML export je responzivní; PDF používá optimalizované rozvržení A4.
- Náročný živý iframe náhled byl z mobilní aplikace odstraněn, protože náhled už není potřeba přímo v LifeHubu.
- KPI Měsíční závazky nově zahrnuje také všechny aktivní měsíční splátky (např. splátku 10 000 Kč).

## v4.8.0 – propojené finance a praktičtější pracovní postupy

- odstraněny duplicitní akce z bezpečnostního panelu na úvodní stránce,
- odměny používají školní období září–prosinec a leden–červen a zachovávají průběžně upravitelné položky,
- přidán náhled tiskové/PDF podoby a HTML souboru v sekci AI výkaz,
- pořízené zahradní položky se ukládají do rozbalovacího archivu,
- systémový fullscreen nahrazen stabilním rozšířeným režimem bez změn mobilního viewportu,
- ručně i automaticky uhrazené účty vytvářejí propojený výdaj ve finanční evidenci,
- smazání závazku odstraní také jeho propojené finanční záznamy; samostatný výdaj lze bezpečně odpojit bez ztráty historie úhrady,
- výplatní pásky rozlišují mzdové období a datum připsání na účet,
- měsíční přehled odděluje bilanci období, odhad dosud nepřijaté mzdy a skutečný hotovostní tok,
- migrace starších dat zachovává stávající záznamy a doplňuje bezpečné výchozí hodnoty.

## v4.7.0 – rychlé odemčení a lepší rodinné sdílení

- volitelné lokální odemčení přes WebAuthn PRF a zámek zařízení,
- hlavní heslo se neukládá a zůstává nouzovou možností i heslem pro obnovu,
- změna hlavního hesla rychlé odemčení bezpečně vypne a vyžádá jeho nové nastavení,
- nové samostatné pole **Jméno v rodinném sdílení**; oslovení „Dane“ se už nepoužívá jako jméno autora,
- rodinný náhled už neopakuje jméno partnera nad každou sekcí,
- URL u velkých nákupů a zahradních položek lze v partnerově náhledu otevřít.

## v4.6.1 – spolehlivé aktualizace PWA

- detekce čekající nové verze,
- bezpečné potvrzení aktualizace,
- aktivace nového service workeru a jednorázové obnovení,
- obcházení staré HTTP cache při kontrole aktualizací,
- ochrana před restartem při neuložených změnách.

## v4.6.0 – prémiové osobní rozhraní

- nový dashboard s dnešním souhrnem úkolů, plateb, nákupního seznamu a záloh,
- spodní mobilní navigace s přístupem ke všem modulům,
- přepracovaná zamykací obrazovka a nová ikona aplikace,
- kompaktnější bezpečnostní panel a sjednocená vizuální hierarchie,
- klávesová zkratka Ctrl/Cmd + F otevře globální hledání.

## v4.5.2 – čistá mzda na první pohled

- výplatní karty mají dominantní údaj **Čistá mzda**,
- samostatně zobrazují **Na účet / dobírka**, hrubou mzdu a daň,
- parser Elanor už nezaměňuje čistou mzdu s částkou skutečně připsanou na účet,
- starší záznamy se automaticky doplní z uložené poznámky bez ztráty dat,
- dlouhý název PDF je skrytý v rozbalovacích technických údajích,
- peněžní příjem nadále používá částku skutečně vyplacenou na účet,
- interaktivní manuál vysvětluje rozdíl mezi čistou mzdou a dobírkou.

## v4.5.1 – čistší mobilní navigace

- Na telefonu a tabletu se v horizontální navigaci zobrazují pouze klikatelné záložky.
- Nadpisy skupin už nevstupují mezi tlačítka a nevzniká duplicita typu „PŘEHLED / Přehled“.
- První desktopová skupina byla přejmenována z „Přehled“ na srozumitelnější „Hlavní“.
- Horizontální navigace má jemné přichytávání položek při posunu.
- Aktualizován interaktivní manuál a PWA cache.

## v4.5.0 – mobilní UX, automatické platby, pásky a nákupní seznam

- Horní lišta na telefonu má dva řádky; stav šifrování už se nepřekrývá s názvem a verzí.
- Splátkový kalendář rozlišuje počet aktivních závazků a odhad zbývajících měsíčních úhrad. Úvodní hlášení už nevypadá jako požadavek zaplatit celý dluh jednou splátkou.
- Platby domácnosti podporují automatický režim pro trvalé příkazy a inkasa. Automatické položky se nezapočítávají mezi ruční úhrady a po termínu se samy posunou.
- Finance podporují hromadný výběr a lokální zpracování více PDF výplatních pásek. Soukromé soubory se nevkládají do GitHub balíku.
- Hromadný nákupní seznam podporuje řádky, čárky, středníky, sekce obchodů a náhled před vložením. Duplicitní otevřené položky se přeskočí.
- Rodinný náhled, CSV/Markdown export a importní sanitizace zachovávají příznak automatické platby.
- Interaktivní manuál byl aktualizován pro všechny uvedené změny.
- Schema stavu zvýšeno na 5 a doplněny regresní testy.

## v4.4.1 – oprava obnovení původního trezoru

- Opravena kritická chyba, kdy startovací kód volal chybějící funkci `hasLegacyState()` a mohl ponechat zobrazený výchozí formulář pro nový PIN.
- LifeHub znovu spolehlivě rozpozná původní šifrovaný trezor v IndexedDB i bezpečnostní kopii v localStorage.
- Převod z localStorage do IndexedDB nyní původní kopii odstraní až po úspěšném odemčení a bezpečném uložení.
- Pokud IndexedDB nelze přečíst nebo obsahuje poškozený záznam, aplikace zablokuje založení nového trezoru a zobrazí bezpečné recovery hlášení.
- Přidána zachytávací obrazovka pro chyby při startu, aby se technická chyba už nemohla tvářit jako prázdná nová instalace.
- Přidány regresní kontroly startovací a migrační logiky.

## v4.4.0 – bezpečné ukládání, čistá data a stabilizace

- Vestavěný interaktivní manuál byl kompletně aktualizován: novinky 4.4, stavy ukládání, ochranná obrazovka, nouzová záloha, přísnější úplnost záloh, rodinný snapshot, soukromé notifikace a řešení problémů.
- Vyhledávání manuálu nově prochází všechny kapitoly, moduly i časté otázky; opravena zastaralá zmínka o 17 částech a popis úložiště.
- Cache service workeru byla obnovena, aby se po nasazení zobrazil nový manuál i v nainstalované PWA.
- Hlavní šifrovaný stav byl přesunut z kapacitně omezeného `localStorage` do IndexedDB; starší trezor se automaticky migruje.
- Přidán řízený stav ukládání (`dirty / pending / failed / saved`) a ochranná obrazovka, která při chybě uložení zabrání ztrátě změn i zobrazení citlivého obsahu.
- Uživatel může uložení zopakovat, stáhnout nouzovou šifrovanou datovou zálohu nebo změny výslovně zahodit a zamknout.
- Všechna modální okna se před zamknutím uzavřou a jejich citlivý obsah se odstraní z DOM.
- Opravena poslední běžná splátka: historie nyní zapisuje pouze skutečně použitou částku.
- Neúplná záloha už nemůže být označena jako kompletní; validace vyžaduje všechny očekávané soubory.
- Mobilní zařízení používají konzervativnější limit kompletní zálohy.
- Rodinný přenos byl zjednodušen na jednosměrný šifrovaný snapshot pouze pro čtení; odstraněny tombstones a nepoužívané slučování.
- Nová rodinná hesla vyžadují minimálně 14 znaků.
- Přidány soukromé notifikace bez jmen věřitelů a částek.
- Service worker při instalaci objeví a uloží i hashované JS/CSS assety; pro chybějící asset už nevrací HTML.
- Manuál hlásí aktivitu hlavní aplikaci, používá sandboxovaný iframe a uvádí správný počet 18 částí.
- Odstraněny skutečné mzdové podklady; testy parseru jsou plně syntetické a CI obsahuje skener citlivých dat.
- Přidány testy životního cyklu ukládání, poslední splátky, úplnosti zálohy, opakovaných termínů, integrity ID, rodinného snapshotu, poškozeného ciphertextu a PWA cache.
- Formuláře finančních částek odmítají nulové transakce, útraty a platby; starý nulový záznam nelze omylem označit jako uhrazený.
- Před rodinným exportem se zobrazí přesný souhrn zahrnutých kategorií a výslovný seznam vyloučených soukromých dat.
- Hlavní soubor byl dále odlehčen o samostatné moduly pro rodinný snapshot a integritu importovaného stavu.

## v4.3.3 – interaktivní manuál přímo v LifeHubu

- Kompletní interaktivní manuál je nově součástí aplikace a instalačního balíčku.
- Položka **Nápověda** byla změněna na **Manuál** a zobrazuje celého průvodce přímo uvnitř LifeHubu.
- Do horní lišty přibylo tlačítko `❔` pro okamžité otevření manuálu.
- Manuál lze také otevřít v samostatném okně na celou obrazovku.
- Obsahuje vyhledávání, mapu všech 18 částí, pracovní scénáře, rodinný náhled, zálohy, bezpečnost, FAQ a checklist.
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
- **Hromadný import pásek z JSON** (tlačítko v kartě výplatních pásek): přidá pásky k současným datům včetně zápisu do příjmů, existující měsíce přeskočí, nic nenahrazuje. Testovací podklady parseru jsou od této verze výhradně syntetické a neobsahují skutečné osobní ani mzdové údaje.
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
