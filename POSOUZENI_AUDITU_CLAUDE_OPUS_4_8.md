# Posouzení auditu Claude Opus 4.8 — LifeHub 4.8.5

**Posuzovaná verze:** LifeHub 4.8.5  
**Výsledná opravená verze:** LifeHub 4.8.6  
**Výsledek:** audit je po věcné stránce velmi kvalitní a hlavní kritické nálezy jsou pravdivé. Není však bezchybný: jeden návrh opravy vytvářel nový budoucí limit, oprava mzdy byla příliš úzká a několik kontrolních počtů bylo nesprávných.

## Celkový verdikt

Claude správně identifikoval všechny zásadní problémové oblasti. Nejdůležitější nález — chybějící `merge()` v migraci starších nešifrovaných dat — je skutečně kritický a může vést k přepsání původních dat prázdným trezorem. Také osmimabajtový limit při odemykání vlastního trezoru, konflikt inline stylů s CSP, chybné použití hrubé mzdy, slabiny service workeru a mrtvý kód byly ve zdrojích verze 4.8.5 skutečně přítomné.

Audit hodnotím přibližně **9/10**:

- **nálezy:** velmi přesné;
- **vysvětlení příčin:** nadstandardní;
- **navržené opravy:** většinou správné;
- **nedostatky:** dvě technická řešení bylo nutné upravit a kontrolní aritmetika testů obsahovala chyby.

## Jak probíhalo nezávislé ověření

1. Balík 4.8.5 byl rozbalen a zkontrolován proti konkrétním tvrzením auditu.
2. Nezměněná verze prošla původním `npm run check` se **79 úspěšnými testy**, přesto obsahovala volání neexistující funkce `merge()`. To přímo potvrzuje, že původní kontrolní řetězec tuto třídu chyb neuměl zachytit.
3. Každý nález byl ověřen ve skutečném toku dat a v návazných funkcích, nikoli pouze vyhledáním řetězce.
4. Potvrzené opravy byly implementovány. U dvou bodů bylo řešení proti auditu zpřesněno.
5. Výsledná verze byla ověřena čistou instalací `npm ci` a kompletním `npm run check`.

## Posouzení jednotlivých změn

| Bod auditu | Verdikt | Co bylo provedeno |
|---|---|---|
| 1. Chybějící `merge()` | **Potvrzeno — kritické** | Doplněn bezpečný rekurzivní merge s blokací `__proto__`, `constructor` a `prototype`. `loadLegacyState()` již nevrací při chybě prázdný stav. |
| 2. Migrace nesmí pokračovat při chybě | **Potvrzeno — kritické** | Načtený stav se kontroluje před `persistEncryptedState()`. Chyba ukončí založení trezoru a původní plaintext zůstane nedotčený. |
| 3. Chybějící statická kontrola | **Potvrzeno — kritické pro prevenci** | Přidán ESLint 9 a `globals`; lint běží jako první část `npm run check`. `no-undef` by původní chybu okamžitě zachytil. Aktualizován `package-lock.json`. |
| 4. Limit 8 MB blokuje vlastní trezor | **Potvrzeno, návrh auditu upraven** | Limit 8 MB zůstal pouze pro cizí importy. Vlastní autentizovaný dešifrovaný stav používá `trusted: true` a agregátní limit se na něj neuplatňuje. Navržený limit 192 MB nebyl použit. |
| 5. CSP blokuje dynamické barvy výkazu | **Potvrzeno** | CSP nebyla oslabena. Hodnoty CSS proměnných se pro tisk doplňují přes `element.style.setProperty()` a CSS obsahuje fallbacky. Samostatně stažený HTML výkaz si zachovává inline hodnoty. |
| 6. Hrubá mzda jako připsaná | **Potvrzeno, audit byl neúplný** | Oprava nebyla omezena na `finance.js`. Hrubý fallback byl odstraněn také z tvorby transakcí, hromadného PDF importu, JSON importu, odhadů a automatické opravy starších pásek. |
| 7. `family-sync.js` je mrtvý kód | **Potvrzeno** | Modul i jeho samoúčelný test byly odstraněny. Používané rodinné snapshoty zůstaly zachovány. |
| 8. Instalace SW je all-or-nothing | **Potvrzeno** | Kritické soubory se ukládají povinně, nepovinné přes `Promise.allSettled`. Jediný chybějící doplňkový asset již neshodí celý offline režim. |
| 9. Navigace SW nemá timeout | **Potvrzeno** | Přidán třísekundový fallback na uložený `index.html`. Zachován přesně jeden výskyt `caches.match('./index.html')`, jak požaduje existující test. |
| 10. Nepoužívané symboly | **Potvrzeno** | Odstraněn nepoužívaný import a funkce `fmt2`, `idbHasRecord`, `sumByMonth`, `familyCountText`. |
| 11. Nereferencované soubory | **Potvrzeno** | Odstraněny staré ikony, duplicitní CSS, nadbytečné kořenové assety a dokumenty duplicitní k `docs/archive`. Nutné Vite/public kopie zůstaly. |
| 12. Verze 4.8.6 | **Potvrzeno** | Sjednoceny `package.json`, lock soubor, konstanty, service worker, HTML, manuál, changelog, README a test manuálu. |
| 13. Regresní testy | **Směr správný, počty auditu chybné** | Přidáno 17 nových testů. Po odstranění 4 testů mrtvého modulu je výsledkem 92 testů, nikoli auditovaných 91. |

## Kde byl audit nepřesný nebo nedostatečný

### 1. Navržený limit vlastního trezoru 192 MB

Audit správně tvrdí, že limit vlastního trezoru nesmí být nižší než objem, který dovolují vlastní limity sanitizeru. Současně ale navrhuje pevný limit 192 MB, přestože teoretický povolený obsah může být větší. Tím by se pouze posunula stejná časovaná bomba z 8 MB na 192 MB.

Navíc se velikost kontroluje až nad již dešifrovaným a parsovaným objektem, takže takový limit není účinnou ochranou před prvotní spotřebou paměti. Bezpečnější je:

- přísně omezovat **cizí vstup před migrací**;
- vlastní autentizovaný stav sanitizovat položku po položce podle existujících limitů kolekcí a polí;
- nezavádět druhý agregátní limit, který může uživatele znovu uzamknout.

### 2. Oprava mzdy pouze v `finance.js` nestačila

Audit našel viditelný následek v Přehledu, ale stejný fallback `netPay || cleanPay || grossPay` se používal také při:

- vytváření transakce po uložení jedné pásky;
- hromadném importu PDF;
- importu pásek z JSON;
- dopočtu starších mzdových transakcí;
- odhadu budoucí výplaty.

Pouhá změna souhrnu by zabránila jednomu chybnému zobrazení, ale v databázi by nadále vznikaly chybné příjmové transakce z hrubé mzdy. Verze 4.8.6 proto opravuje celý řetězec.

Při odemčení se navíc odstraní starší automaticky vytvořená mzdová transakce, pokud je propojena s páskou bez čisté mzdy a její částka se přesně rovná hrubé mzdě. Ručně opravená částka, která se od hrubé liší, se zachová.

### 3. Počty testů v auditu

V uvedeném souboru `v486-static.test.mjs` je **16**, nikoli 17 testů. Odstraňovaný `family-sync.test.mjs` obsahoval **4**, nikoli 5 testů. Výsledek 91 byl v auditu shodou okolností správný, protože obě chyby se navzájem vyrušily:

`79 - 4 + 16 = 91`

Implementovaná sada obsahuje 17 nových testů, takže skutečný výsledek je:

`79 - 4 + 17 = 92`

### 4. Počet položek `STATIC_SHELL`

Audit na jednom místě uvádí devět položek, ale seznam obsahuje **deset** položek včetně `./`. Všechny byly po buildu ověřeny v `dist/`.

### 5. Drobná číselná chyba v úvodu

Text uvádí, že lint je „změna 2“, ve vlastní struktuře dokumentu je však ESLint změna 3. Na implementaci to nemá dopad.

## Rozšířená oprava mzdových dat

Verze 4.8.6 používá tuto logiku:

- preferovaná částka příjmu: `netPay`, následně `cleanPay`;
- `grossPay` je pouze informativní údaj pásky;
- pokud čistá částka chybí, páska se může uložit, ale nevznikne příjmová transakce;
- uživatel dostane viditelné upozornění v Přehledu i při importu;
- staré automatické transakce přesně ve výši hrubé mzdy jsou odstraněny;
- ručně opravené částky se zachovají;
- nedochází k dvojímu započtení pásky a propojené transakce.

## Ověření výsledné verze

Čistá instalace a kompletní kontrola:

```text
npm ci                     OK, 0 zranitelností
npm run check:lint         OK, 0 problémů
npm run check:syntax       OK
npm run check:sensitive    OK
npm test                    92/92 úspěšných
npm run check:smoke        OK — LifeHub 4.8.6
npm run build              OK — 23 modulů
```

Doplňkové statické kontroly:

```text
style=" v lifehub-app.js                 1 výskyt — pouze helper cssVar()
function merge(base, patch)              1 definice
caches.match('./index.html') v sw.js     1 výskyt
STATIC_SHELL po buildu                    10/10 souborů přítomno
```

## Co zůstalo záměrně mimo verzi 4.8.6

Stejně jako audit jsem do opravného vydání nezařadil:

- nový maskable ikonový asset;
- změnu výchozího počtu KDF iterací a rotaci existujících klíčů;
- rozšíření sensitive-data skeneru na všechny kořenové Markdowny;
- architektonické odstranění duplicitního CSS výkazu;
- plošný úklid veškeré historické dokumentace.

Jde o samostatné změny s vlastním rizikem nebo designovým rozhodnutím, nikoli o bezpečné bodové opravy.

## Důležité upozornění k datům z verze 4.8.5

Oprava chrání pouze legacy data, která ještě existují. Pokud už byla ve verzi 4.8.5 provedena chybná migrace a klíč `lifehub.v2.state` byl odstraněn, samotná aktualizace původní data neobnoví. V takovém případě je nutná dřívější záloha nebo jiná kopie profilu prohlížeče.

## Doporučení

Verzi 4.8.6 lze nasadit jako opravné vydání. Po nasazení doporučuji ručně ověřit na kopii dat tři scénáře, které automatické Node testy nemohou plně simulovat:

1. migraci skutečného staršího plaintextového stavu;
2. tisk měsíčního AI výkazu v cílovém prohlížeči;
3. offline otevření PWA a návrat z pomalé sítě.

Tyto ruční kontroly nejsou známkou nehotového kódu; jde o finální ověření chování prohlížeče, tiskového dialogu a service workeru v reálném zařízení.
