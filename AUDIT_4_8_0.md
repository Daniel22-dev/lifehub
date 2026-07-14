# LifeHub 4.8.0 – audit změn

## Realizované požadavky

1. **Úvodní stránka:** bezpečnostní panel už neduplikuje rychlé přidání úkolu ani otevření financí.
2. **Odměny:** školní rok je rozdělen na září–prosinec a leden–červen; položky jsou průběžně upravitelné a staré formáty období se migrují.
3. **AI výkaz:** přidán náhled tiskové/PDF stránky a přesná podoba staženého HTML.
4. **Pořízené položky:** dokončené zahradní nákupy jsou mimo aktivní seznam v rozbalovacím archivu.
5. **Rozšířený režim:** odstraněna závislost na nestabilním mobilním Fullscreen API.
6. **Účty a finance:** nové ruční i automatické úhrady vytvářejí propojený výdaj; záznam lze odpojit a vazby se čistí při smazání závazku.
7. **Mzda:** mzdové období je oddělené od data připsání; aplikace ukazuje bilanci období, skutečný hotovostní tok a odhad dosud nepřijaté mzdy.

## Migrace a bezpečnost

- schema stavu: 8,
- hlavní heslo a biometrické odemykání zůstávají zachované,
- stará odměnová období se převedou automaticky,
- u starších plateb se zapne propojení pro budoucí úhrady,
- stará historie úhrad se zpětně nepřevádí do financí, aby nevznikly duplicitní výdaje,
- starší výplatní pásky dostanou odhadované datum připsání podle existující mzdové transakce nebo výchozího termínu.

## Kontrola

- 63 / 63 automatických testů,
- kontrola syntaxe,
- kontrola citlivých dat,
- PWA smoke test,
- produkční Vite build.
