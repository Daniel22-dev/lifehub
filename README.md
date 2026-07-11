# LifeHub 4.3.3

LifeHub je lokální šifrovaná PWA pro osobní a rodinnou správu poznámek, financí, plateb domácnosti, výplatních pásek, úkolů, nákupů, splátek, zahrady, projektů a soukromých dokumentů.

## Stav projektu

**Verze 4.3.3 je připravena jako oficiální osobní nástroj s bezpečným rodinným náhledem.** Data zůstávají v prohlížeči a po odemčení jsou uložena šifrovaně. LifeHub není cloudová služba: každé zařízení má vlastní trezor a rodinný soubor slouží pouze k zobrazení partnerových vybraných údajů.

## Rodinný náhled 4.3.3

Rodinný soubor je chráněný společným heslem a druhému zařízení zobrazí pouze náhled:

- společných příjmů a výdajů,
- rozpočtu na jídlo a benzín včetně limitů,
- plateb domácnosti a historie úhrad,
- nákupního seznamu,
- rodinných úkolů,
- velkých a plánovaných nákupů,
- splátek včetně běžných a mimořádných plateb,
- zahradních věcí k pořízení a deníku údržby.

Importovaný obsah je vždy pouze pro čtení. Nezapisuje se do vlastních záložek, neslučuje se s vlastními daty a nelze jej v partnerském náhledu upravovat. Novější partnerův soubor jednoduše nahradí předchozí náhled. Výplatní pásky, PDF, dokumenty, poznámky, AI výkaz, odměny a přehled vyvíjených aplikací se do rodinného souboru nezahrnují.

Rodinné heslo se na každém zařízení zadává pouze jednou. Uloží se uvnitř lokálního šifrovaného trezoru, takže se po automatickém 15minutovém zamknutí nezadává znovu. Export i načtení ho používají automaticky. Heslo lze změnit nebo odstranit v Nastavení. Do samotného rodinného souboru se nikdy neukládá.
Nešifrovaná datová záloha ho neobsahuje; součástí může být pouze šifrovaná datová nebo kompletní záloha.

## Bezpečnost a zálohy

- AES-GCM šifrování stavu, PDF a dokumentů; klíč se odvozuje z hesla pomocí PBKDF2-SHA256.
- Kompletní šifrovaná záloha přenáší i soubory z IndexedDB.
- Datová záloha přenáší stav aplikace bez PDF a dokumentů.
- Rodinný náhledový soubor je samostatný, obsahuje jen sdílené kolekce a po importu nemění vlastní data.
- Heslo nelze obnovit. Udržuj pravidelnou kompletní zálohu mimo zařízení.

## Struktura

```text
index.html
src/
  app/lifehub-app.js
  config/constants.js
  core/
  features/
    backup.js
    backup-validation.js
    budget.js
    family-sync.js
    finance.js
    payroll-elanor.js
  pwa/
  security/
  storage/
  styles/
public/
tests/
scripts/
.github/workflows/
```

## Lokální spuštění a kontrola

```bash
npm ci
npm run dev
npm run check
```

`npm run check` provede syntax check, všechny jednotkové testy, statický smoke test a produkční build.

## GitHub Pages

1. Nahraj obsah projektu do kořene repozitáře.
2. V **Settings → Pages** nastav zdroj **GitHub Actions**.
3. Push do větve `main` spustí úplnou kontrolu a nasazení výstupu `dist`.

Do veřejného repozitáře nenahrávej exporty, zálohy, PDF ani jiné osobní dokumenty.

## Interaktivní manuál v aplikaci

LifeHub obsahuje soubor `public/manual.html`, který se v produkčním buildu publikuje jako `manual.html`. Otevřeš jej:

- tlačítkem `❔` v horní liště,
- položkou **Manuál** v postranní navigaci,
- případně tlačítkem **Otevřít na celou obrazovku**.

Manuál funguje offline, je součástí PWA cache a nepracuje s osobními daty trezoru.
