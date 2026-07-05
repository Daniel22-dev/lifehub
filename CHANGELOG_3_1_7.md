# LifeHub 3.1.7-modular-step-6 – výpis změn

Verze aplikace: `3.1.7-modular-step-6` (sjednoceno v `src/config/constants.js` i `package.json`).

## Viditelná verze + změnový log v aplikaci

- V **patičce** je teď vidět číslo verze (odznak „LifeHub v3.1.7-…“). Podle něj hned poznáš,
  jestli běží nová verze, nebo ještě stará z cache.
- **Klepnutím na odznak** se otevře krátký změnový log s posledními novinkami – aplikace tak
  konečně má „co je nového“ přímo v sobě. Seznam se udržuje v poli `CHANGELOG` v `lifehub-app.js`.

## Automatická aktualizace po nasazení

- Service worker teď u načtení HTML **obchází HTTP cache prohlížeče** (`cache: 'no-store'` pro
  navigaci), takže po nasazení stáhne aktuální `index.html` i nové hashované JS/CSS a neservíruje
  starou verzi.
- Zvýšena verze cache (`lifehub-vite-shell-v3`) – při aktivaci nového SW se stará cache promaže.
- Po převzetí řízení novou verzí SW se aplikace **jednou sama obnoví** (jen při skutečné
  aktualizaci, ne při prvním otevření). Aktualizace se navíc kontroluje při každém návratu do
  aplikace (přepnutí zpět na záložku/PWA).

## Jak ověřit, že se změna projevila

1. Počkej, až je GitHub Action zelená (build hotový).
2. Otevři aplikaci; pokud ji máš otevřenou, přepni na jinou záložku a zpět – do minuty by se měla
   sama obnovit. Případně jednou tvrdě obnov (Ctrl+Shift+R / na mobilu zavři a znovu otevři PWA).
3. V patičce zkontroluj číslo verze – musí odpovídat nasazené verzi.
4. Věcná zkouška splátek: nová půjčka 120 000 / 10 000 → „zbývá 120 000“, tlačítko „+ mimořádná“.
