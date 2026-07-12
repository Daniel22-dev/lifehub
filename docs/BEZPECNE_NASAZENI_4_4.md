# Bezpečné nasazení LifeHubu 4.4.0

## Důležité před nahráním na GitHub

Tento balík už neobsahuje skutečné výplatní podklady. Testy parseru používají pouze syntetická data a příkaz `npm run check` obsahuje samostatný skener známých citlivých fixtures.

Pokud však byl starší soubor s reálnými mzdovými údaji někdy nahrán do veřejného repozitáře, jeho prosté smazání v novém commitu nestačí. Soubor může zůstat v historii Git repozitáře.

### Nejjednodušší bezpečná varianta pro práci přes web GitHubu

1. Ověřte, zda byl starší balík s citlivým souborem skutečně nahrán do veřejného repozitáře.
2. Pokud ano, stáhněte si vše potřebné a starý repozitář odstraňte nebo nastavte jako soukromý.
3. Založte nový čistý repozitář.
4. Nahrajte do jeho kořene pouze obsah tohoto balíku LifeHub 4.4.0.
5. V GitHub Pages nastavte zdroj **GitHub Actions**.

Tento postup je pro uživatele bez terminálu bezpečnější než ruční přepisování historie.

## Co do repozitáře nikdy nepatří

- exporty LifeHubu a soubory `.lifehub-family`,
- šifrované i nešifrované zálohy,
- skutečné PDF výplatních pásek,
- dokumenty z trezoru,
- screenshoty nákupních seznamů,
- soubory se skutečnými mzdovými nebo osobními údaji.

## Kontrola před nasazením

```bash
npm ci
npm run check
```

Kontrola musí skončit bez chyby. Zvlášť důležitý je krok `check:sensitive`.
