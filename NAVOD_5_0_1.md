# Nasazení LifeHub 5.0.1 na GitHub

## Před aktualizací

1. V současném LifeHubu vytvořte **kompletní šifrovanou zálohu**.
2. Ověřte, že znáte hlavní heslo trezoru.
3. Na GitHubu otevřete repozitář LifeHubu.

## Nahrání verze 5.0.1

1. Rozbalte balíček `lifehub-5.0.1-shopping-combination.zip`.
2. Nahrajte **celý obsah složky `lifehub-main`** do kořene repozitáře.
3. Povolte přepsání stávajících souborů.
4. Složky `node_modules` ani `dist` se na GitHub nenahrávají; v připraveném balíčku nejsou.
5. Počkejte, až GitHub Actions / GitHub Pages dokončí nové nasazení.

## Kontrola po nasazení

1. Otevřete LifeHub a zkontrolujte označení verze **5.0.1**.
2. Odemkněte aplikaci běžným hlavním heslem.
3. Otevřete **Velké nákupy**.
4. Zaškrtněte dvě položky pomocí volby **Do kombinace**.
5. Ověřte, že se v bloku **Kalkulačka kombinace** zobrazí správný součet.
6. Vyzkoušejte změnu filtru; dříve vybrané položky musí v kombinaci zůstat.
7. Vyzkoušejte **Vybrat zobrazené** a **Zrušit výběr**.
8. Po úspěšné kontrole vytvořte novou kompletní šifrovanou zálohu.

## Když telefon stále ukazuje starší verzi

1. Zavřete LifeHub.
2. Otevřete ho znovu a potvrďte nabídnutou aktualizaci.
3. Pokud se nabídka neobjeví, otevřete aplikaci jednou v běžném prohlížeči a stránku obnovte.
4. Nesmazávejte data webu ani aplikaci neodinstalovávejte bez ověřené kompletní zálohy.
