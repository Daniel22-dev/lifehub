# LifeHub 4.4.0 – souhrn auditu a provedených oprav

## Verdikt

Verze 4.4.0 je stabilizační a bezpečnostní release. Odstraňuje blokující nálezy auditu 4.3.3 a je připravena pro osobní produkční používání za předpokladu silného hesla, chráněného zařízení a pravidelných ověřených záloh.

Nejde o nezávisle certifikovaný password manager ani cloudovou databázi. LifeHub je lokální osobní PWA.

## Kritické opravy

- Odstraněny skutečné mzdové podklady ze zdrojového balíku.
- Testy výplatních pásek používají výhradně syntetická jména, zaměstnavatele a částky.
- CI obsahuje skener známých citlivých fixtures.
- Před zamknutím se zavřou a vyčistí všechna modální okna; zamykací a ochranná obrazovka mají vyšší vrstvu a vlastní focus trap.
- Selhání uložení už nemůže vést k tichému vymazání stavu z paměti.
- Přidána nouzová šifrovaná datová záloha aktuálního stavu z paměti.

## Data a úložiště

- Hlavní šifrovaný stav je uložen v IndexedDB; starší šifrovaný stav z `localStorage` se automaticky převede.
- Ukládání má explicitní životní cyklus `dirty / pending / failed / saved`.
- Rychlé změny se slučují krátkým debounce a uchovává se nejnovější snapshot.
- Importy dostávají aktuální `schemaVersion` a duplicitní ID se bezpečně opravují.

## Finance a platby

- Poslední pravidelná splátka zapisuje do historie pouze skutečně zbývající částku.
- Nulové transakce, útraty a platby domácnosti jsou odmítnuty.
- Soukromé notifikace standardně nezobrazují věřitele ani částky na zamykací obrazovce zařízení.

## Zálohy

- Kompletní záloha musí obsahovat všechny PDF a dokumenty, které metadata označují jako uložené.
- Chybějící soubor znamená neúplnou zálohu; datum poslední kompletní zálohy se nezmění.
- Mobilní export i import používají konzervativnější velikostní limity kvůli paměťové náročnosti Base64 a AES-GCM.
- Service worker precachuje hashované JS/CSS soubory a HTML fallback používá pouze pro navigaci.

## Rodinný náhled

- Odstraněna nepoužívaná obousměrná synchronizace, slučování a tombstones.
- Rodinný soubor je jednosměrný šifrovaný snapshot pouze pro čtení.
- Nové rodinné heslo musí mít minimálně 14 znaků.
- Před exportem se zobrazí počty zahrnutých kategorií a výslovný seznam vyloučených soukromých dat.
- Výplatní pásky, mzdové transakce, dokumenty, poznámky, AI výkaz, odměny a aplikace se nepřenášejí.

## Manuál a navigace

- Manuál správně uvádí 18 částí a verzi 4.4.0.
- Iframe manuálu je sandboxovaný a předává aktivitu hlavní aplikaci, takže aktivní čtení manuálu nespustí falešnou neaktivitu.
- Navigace je rozdělena do tematických skupin.

## Automatické ověření

Release prochází:

- syntax checkem všech modulů,
- skenerem citlivých podkladů,
- 31 jednotkovými a statickými testy,
- smoke testem produkčních vazeb,
- produkčním Vite buildem,
- kontrolou npm závislostí bez známých zranitelností.

Testy zahrnují kryptografické parametry, špatné heslo a poškozený ciphertext, úplnost zálohy, poslední splátku, termíny opakovaných plateb, životní cyklus uložení, rodinné vyloučení mezd, duplicitní ID, manuál a PWA cache.

## Záměrné technické hranice

- Kompletní záloha používá jeden šifrovaný JSON; na mobilu je proto zvolen nižší bezpečnostní limit místo rizikového zpracování stovek MB v paměti.
- Hlavní controller je stále rozsáhlý. Kritické a čisté domény jsou modularizované, ale úplné rozdělení všech 18 DOM obrazovek má pokračovat až s plnohodnotnými browserovými E2E testy.
