# LifeHub 4.5.4

## Oprava sdílení přes WhatsApp na Androidu

- Přímé systémové sdílení už nepoužívá vlastní neznámý MIME typ `application/octet-stream`, který některé verze Androidu/Chromu odmítnou ještě před otevřením nabídky sdílení.
- Pro sdílení se vytváří kompatibilní soubor `lifehub-rodina-YYYY-MM-DD.lifehub-family.txt` s typem `text/plain`. Obsah zůstává plně zašifrovaný.
- Běžné stažení nadále vytváří původní soubor `.lifehub-family`.
- Import přijímá `.lifehub-family`, `.txt` i starší `.json`.
- Při dalším selhání se zobrazí název chyby pro přesnější diagnostiku.
