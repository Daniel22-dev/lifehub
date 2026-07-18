# Nasazení LifeHub 5.0.0 na GitHub

## Co nahrát

Nahrajte **obsah složky `lifehub-main`** z balíčku do kořene stávajícího repozitáře LifeHubu. Potvrďte nahrazení změněných souborů.

V kořeni repozitáře musí zůstat přímo například:

- `index.html`
- `package.json`
- `package-lock.json`
- složky `src`, `public`, `tests`, `scripts` a `.github`

## Doporučený postup

1. Před nasazením si vytvořte aktuální kompletní šifrovanou zálohu LifeHubu.
2. Nahrajte celý obsah balíčku 5.0.0 do kořene repozitáře.
3. Commit lze pojmenovat:

```text
LifeHub 5.0.0 – Projekty domu
```

4. Vyčkejte na dokončení GitHub Actions.
5. Otevřete nasazenou aplikaci a přijměte nabídnutou aktualizaci PWA.
6. Pokud se stará verze drží v cache, aplikaci úplně zavřete a znovu spusťte nebo proveďte tvrdé obnovení.

## Očekávaná automatická kontrola

```text
npm ci
npm run check
```

Výsledek:

- ESLint: 0 problémů
- syntaxe: OK
- citlivá data: OK
- testy: 111/111
- smoke test: OK
- produkční build: OK

## Ruční kontrola po nasazení

1. Na titulku a zámkové obrazovce je verze **5.0.0**.
2. Původní trezor se otevře stejným heslem a dosavadní data zůstanou zachována.
3. V navigaci je záložka **Projekty domu**.
4. Vytvořte zkušební projekt, přidejte poznámku, odkaz a rozpočtovou položku.
5. Nahrajte testovací obrázek a vytvořte náčrt.
6. Vytvořte kompletní šifrovanou zálohu; musí zahrnout také projektové přílohy.
