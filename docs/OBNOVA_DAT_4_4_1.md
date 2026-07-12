# Obnova původních dat po aktualizaci na LifeHub 4.4.1

Verze 4.4.0 obsahovala regresní chybu ve startovací bráně. Kód po načtení lokálního trezoru volal chybějící funkci `hasLegacyState()`. Spuštění se přerušilo a na obrazovce mohl zůstat výchozí formulář pro založení nového PINu, přestože původní šifrovaná data v telefonu nadále existovala.

## Bezpečný postup

1. Nezakládejte nový trezor a nemažte data webu ani aplikace.
2. Nahrajte na GitHub obsah balíku LifeHub 4.4.1.
3. Na telefonu LifeHub úplně zavřete a znovu otevřete z původní ikony.
4. Obrazovka má zobrazit **Odemknout šifrovaný LifeHub**.
5. Zadejte původní PIN/heslo.
6. Po odemčení počkejte na stav **Šifrováno HH:MM**.
7. Vytvořte novou kompletní šifrovanou zálohu a ověřte ji bez importu.

## Co oprava dělá

- hledá trezor nejprve v IndexedDB,
- kontroluje také starší bezpečnostní kopii v `localStorage`,
- bezpečnostní kopii nemaže před úspěšným odemčením a uložením,
- při nedostupném nebo poškozeném úložišti zablokuje vytvoření nového trezoru,
- při neočekávané chybě zobrazí recovery hlášení místo formuláře pro nový PIN.

Pokud se po nasazení stále zobrazuje založení nového trezoru, nic nezadávejte a nemažte. Je potřeba zkontrolovat, zda telefon načetl verzi 4.4.1 a zda prohlížeč nezobrazuje starou offline cache.
