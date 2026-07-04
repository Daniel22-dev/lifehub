# LifeHub 3.2 Vite Modular

Statická osobní aplikace LifeHub připravená pro GitHub Pages přes Vite build a GitHub Actions.

## Struktura

```text
index.html
src/
  main.js
  app/lifehub-app.js
  config/constants.js
  pwa/register-sw.js
  styles/lifehub.css
public/
  manifest.json
  sw.js
  icons
  vendor/pdf.min.mjs
  vendor/pdf.worker.min.mjs
.github/workflows/deploy.yml
vite.config.js
package.json
```

## Lokální spuštění

```bash
npm install
npm run dev
```

## Produkční build

```bash
npm run build
npm run preview
```

## GitHub Pages

1. Nahraj projekt do repozitáře.
2. V Settings -> Pages nastav Source: GitHub Actions.
3. Push do větve `main` spustí workflow `.github/workflows/deploy.yml`.
4. Výstup se publikuje ze složky `dist`.

`vite.config.js` v GitHub Actions automaticky nastaví `base` podle názvu repozitáře. Pro vlastní doménu nebo speciální cestu nastav proměnnou `LIFEHUB_BASE`.

## Soukromí

Do repozitáře nepatří PDF, exporty, JSON zálohy ani osobní data. `.gitignore` blokuje běžné typy citlivých exportů, ale před commitem vždy zkontroluj `git status`.
