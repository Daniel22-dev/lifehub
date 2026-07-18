# LifeHub 5.0.0 – Projekty domu

## Nová záložka Projekty domu

- samostatné projektové karty pro větší rekonstrukce a investice,
- stavy **Nápad, Průzkum, Plánování, Realizace, Pozastaveno a Dokončeno**,
- priorita, oblast domu, plánovaný začátek a cílové dokončení,
- stručné zadání, hlavní požadavky a tagy,
- filtrování a řazení portfolia projektů.

## Rozpočty a nabídky

- cílový rozpočet projektu,
- položky materiálu, práce, technologií, dopravy, dokumentace a rezervy,
- množství, jednotka, cena za jednotku a automatický plánovaný součet,
- skutečně zaplacená částka,
- stav položky: odhad, nabídka, objednáno nebo zaplaceno,
- dodavatel, odkaz a doplňující poznámka,
- souhrn plánovaných a skutečných nákladů a graf podle kategorií,
- export položkového rozpočtu do CSV.

## Výzkum a projektové podklady

- samostatné poznámky pro měření, rozhodnutí, varianty a úkoly,
- odkazy na vlákna ChatGPT, Claude, Gemini, web, e-shopy a dodavatele,
- krátké shrnutí obsahu každého odkazu,
- šifrované obrázky, PDF, dokumenty, tabulky a textové soubory,
- automatické zmenšení velkých fotografií,
- kreslicí plocha pro vlastní náčrty s barvou, tloušťkou a krokem zpět,
- náčrt se ukládá jako šifrovaný PNG soubor,
- export celého projektu do Markdownu.

## Zálohy a bezpečnost

- projektová data jsou součástí datové i kompletní šifrované zálohy,
- skutečné projektové soubory se přenášejí pouze kompletní šifrovanou zálohou,
- kontrola úplnosti zálohy ověřuje také všechny projektové přílohy,
- importovaný stav je whitelistově sanitizován,
- starší trezory se automaticky migrují na schema verze 10 bez změny dosavadních dat.

## Kontrola vydání

- ESLint bez chyb,
- syntaktická kontrola všech modulů,
- kontrola citlivých dat,
- 111 automatických testů,
- smoke test,
- produkční Vite build.
