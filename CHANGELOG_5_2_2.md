# LifeHub 5.2.2

## Přímé PDF pro elektrikáře

- V záložce **Elektřina – Marek** zůstalo jediné hlavní tlačítko **Stáhnout PDF pro Honzu Marka**.
- Export už nepoužívá společný tiskový režim LifeHubu, takže se neotevírá náhled aplikace ani systémový tiskový dialog.
- PDF vzniká kompletně lokálně v prohlížeči a stáhne se jako samostatný soubor.
- Dokument obsahuje hlavičku, datum vytvoření, počet položek, počet materiálových položek, celkový odhad materiálu a všechny poznámky, nápady, ceny i odkazy.
- Delší popisy a větší počet položek se automaticky rozdělí na více stran A4.
- Odstraněn nepotřebný CSV export a textová instrukce k ukládání přes tiskový dialog.

## Prevence návratu chyby

- Původní funkce `buildElectricityReportHtml()` byla odstraněna.
- Tlačítko už nemůže volat společnou funkci `printReport()`.
- Přidán samostatný modul `src/features/electricity-pdf.js` bez externích síťových závislostí.
- Přidány regresní testy přímého stažení, absence tiskové vrstvy a platné PDF obálky.
