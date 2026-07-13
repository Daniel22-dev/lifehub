# LifeHub 4.6.1

## Oprava aktualizací nainstalované aplikace

- LifeHub nyní rozpozná novou čekající verzi service workeru.
- Uživatel dostane bezpečnou nabídku **Aktualizovat nyní / Později**.
- Po potvrzení se nový service worker aktivuje a aplikace se obnoví pouze jednou.
- Aktualizace se nekontroluje přes starou HTTP cache (`updateViaCache: none`).
- Kontrola proběhne při spuštění, po návratu do aplikace a jednou za 30 minut.
- Pokud jsou v aplikaci neuložené změny, aktualizace se neaktivuje a LifeHub nejprve vyžádá jejich bezpečné uložení.
- Lokální trezor, PIN, databáze a formát záloh zůstávají beze změny.
