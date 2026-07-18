# LifeHub 4.9.1 – automatický splátkový kalendář

## Opravený problém

Pole „Den v měsíci (splatnost)“ bylo dříve pouze informační. Po uplynutí termínu se dluh ani počet zbývajících splátek automaticky nezměnil a uživatel musel ručně stisknout „+ splátka“.

## Nové chování

- při každém odemčení LifeHub zkontroluje aktivní splátkové kalendáře,
- po dosažení nastaveného dne automaticky zapíše běžnou měsíční splátku,
- sníží zbývající dluh a počet zbývajících plateb,
- vytvoří propojený výdaj v modulu Příjmy a výdaje,
- při delší době bez otevření doplní všechna již splatná období,
- stejný měsíc nikdy nezapočítá dvakrát,
- den 29.–31. se v kratším měsíci posune na jeho poslední den,
- mimořádná splátka nenahrazuje pravidelnou měsíční úhradu,
- znovu otevřený kalendář nezačne omylem doplácet staré termíny.

## Ověření

- 102 automatických testů: úspěšné,
- ESLint a syntaktická kontrola: úspěšné,
- kontrola citlivých dat: úspěšná,
- smoke test PWA a verzí: úspěšný,
- produkční sestavení Vite: úspěšné.
