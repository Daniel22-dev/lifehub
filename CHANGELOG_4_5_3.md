# LifeHub 4.5.3

## Rodinné sdílení na Androidu

- Rodinný soubor se vytváří s příponou `.lifehub-family`.
- Soubor má obecný MIME typ `application/octet-stream`, takže HyperOS a Android ho nepovažují za běžný JSON určený k otevření v ChatGPT nebo editoru.
- Na podporovaných telefonech LifeHub po vytvoření nabídne přímo **Sdílet přes…**, odkud lze vybrat WhatsApp.
- Zůstává dostupná volba **Stáhnout do zařízení** a automatický fallback při selhání systémového sdílení.
- V záložce Rodina je doplněn krátký návod pro příjemce: soubor se neotevírá přímo, ale vybírá se uvnitř LifeHubu přes **Načíst rodinný soubor**.
- Import nadále podporuje starší `.json` soubory.
