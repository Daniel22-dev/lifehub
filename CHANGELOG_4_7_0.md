# LifeHub 4.7.0

## Rychlé odemčení

- Po prvním odemčení hlavním heslem lze v Nastavení aktivovat otisk prstu nebo zámek zařízení.
- Implementace používá WebAuthn PRF: klíč trezoru je uložen pouze v zašifrované podobě v lokálním IndexedDB.
- Hlavní heslo zůstává nutné pro obnovu zálohy, nové zařízení a nouzový přístup.
- Změna hlavního hesla rychlé odemčení vypne; uživatel ho poté znovu aktivuje.
- Biometrický záznam se nepřenáší v záloze ani rodinném souboru.

## Rodinné sdílení

- Přidáno samostatné pole „Jméno v rodinném sdílení“.
- Pozdrav „Dane“ se už nepoužívá jako autor rodinného souboru.
- Jméno partnera se zobrazuje jen v hlavičce náhledu, ne před názvem každé sekce.
- Velké nákupy a zahradní položky zobrazují bezpečně ověřené klikatelné URL.

## Kompatibilita

- Datové schéma bylo zvýšeno na verzi 7.
- Stávající data a hlavní heslo zůstávají zachována.
- Na nepodporovaných zařízeních LifeHub automaticky zůstane u odemykání hlavním heslem.
