# LifeHub 4.8.4 – finanční souhrn a propojené splátky

## Co je nové

- Na záložce **Přehled** je nový blok **Výplata vs. všechny aktuální a plánované výdaje**.
- Souhrn porovnává výplatu skutečně připsanou v aktuálním kalendářním měsíci s:
  - již zapsanými výdaji v Příjmech a výdajích,
  - útratami za jídlo a benzín,
  - dosud neuhrazenými účty, fakturami, inkasy a trvalými příkazy,
  - zbývající běžnou splátkou v daném měsíci,
  - nevyčerpanou částí měsíčního plánu na jídlo a benzín.
- Výsledek **Po všech výdajích** ukazuje očekávanou částku, která zůstane po skutečných i plánovaných výdajích.
- Výplata se započítává podle data připsání, přičemž se zároveň zobrazuje její mzdové období.
- Budoucí splátka se do plánu nezapočítá před svým nastaveným počátečním měsícem.

## Splátkový kalendář

- Tlačítko **+ splátka** ihned vytvoří propojený výdaj v modulu Příjmy a výdaje.
- Stejně se zapisuje také **mimořádná splátka**.
- Starší záznamy v historii splátek se po prvním odemčení doplní do financí.
- Existující odpovídající ruční výdaj se může propojit namísto vytvoření duplicity.
- Propojený finanční záznam lze od splátky odpojit; aplikace jej poté znovu automaticky nevytvoří.
- Smazání splátkového kalendáře odstraní i jeho propojené finanční záznamy.

## Další opravy

- Opravena syntaktická chyba interaktivního manuálu verze 4.8.3.
- Aktualizována PWA cache a produkční sestavení.
- Všechny automatické kontroly prošly: 74 testů z 74.
