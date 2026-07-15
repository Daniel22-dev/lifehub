# Nasazení LifeHub 4.8.6 na GitHub

## Co nahrát

Nahrajte **obsah** balíčku `LifeHub-v4.8.6-GITHUB-READY.zip` do kořene stávajícího repozitáře LifeHubu a potvrďte nahrazení změněných souborů i odstranění souborů, které už v balíčku nejsou.

Nenahrávejte nadřazenou složku jako další vnořenou úroveň. V kořeni repozitáře musí být přímo například:

- `index.html`
- `package.json`
- `package-lock.json`
- `eslint.config.mjs`
- složky `src`, `public`, `tests`, `scripts`, `.github`

## Doporučený postup

1. Před změnou stáhněte nebo označte poslední funkční verzi 4.8.5.
2. Nahrajte celý obsah balíčku 4.8.6 do kořene repozitáře.
3. Zkontrolujte, že GitHub eviduje také odstranění starých ikon, duplicitního `lifehub.css`, `family-sync.js` a jeho testu.
4. Commit pojmenujte například:

```text
LifeHub 4.8.6 – bezpečná migrace a opravný audit
```

5. Vyčkejte na dokončení GitHub Actions.
6. Otevřete nasazenou aplikaci a přijměte nabídku aktualizace PWA. Pokud se neukáže, proveďte tvrdé obnovení stránky.

## Co musí projít v GitHub Actions

```text
npm ci
npm run check
```

Očekávaný výsledek:

- ESLint: 0 problémů
- syntaxe: OK
- citlivá data: OK
- testy: 92/92
- smoke test: LifeHub 4.8.6 OK
- build: OK

## Ruční kontrola po nasazení

1. Na titulku a zámkové obrazovce je verze **4.8.6**.
2. Stávající šifrovaný trezor se otevře původním heslem.
3. AI výkaz → **Vygenerovat PDF (tisk)** zobrazí barevný graf, tečky legendy i číslování řádků.
4. Po načtení aplikace ji zkuste otevřít bez internetu.
5. U pásky, která obsahuje pouze hrubou mzdu, se nevytvoří příjem. Doplňte čistou mzdu nebo částku na účet.

## Upozornění k migraci 4.8.5

Pokud chybná migrace ve verzi 4.8.5 již proběhla a původní plaintext byl smazán, verze 4.8.6 jej neumí zpětně obnovit. Oprava chrání data, která v prohlížeči ještě existují. Pro dříve ztracený stav je nutná záloha nebo kopie profilu prohlížeče.
