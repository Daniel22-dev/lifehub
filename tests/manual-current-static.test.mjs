import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const manual = fs.readFileSync(new URL('../public/manual.html', import.meta.url), 'utf8');

test('interaktivní manuál odpovídá funkcím LifeHubu 5.1.0', () => {
  for (const text of [
    'LifeHub 5.1.0',
    'automaticky vytvoří propojený výdaj',
    'Zahradní nákupy',
    'Zahradní údržba a servis domácnosti',
    'Označit jako pořízené',
    'Servis a údržba',
    'Kalkulačka kombinace',
    'Do kombinace',
    'Součet vybraných položek',
    'Projekty domu',
    'Plány a postupy',
    'Kdo zaplatil',
    'Zaplatila manželka',
    'Náklady domácnosti',
    'bezpečně odděleném sandboxu',
    'GPT / Claude vlákna',
    'kreslených náčrtů',
    'Elektřina – Marek',
    'Servis domácnosti',
    'Uložit jako PDF',
    'Aktivuj rychlé odemčení telefonu',
    'Jméno v rodinném sdílení',
    'klikatelné odkazy',
    'Zapsat po úhradě do financí',
    'Mzdové období',
    'logo a úplný název školy',
    'září–prosinec a leden–červen',
    'Dokončené úkoly',
    'Doplacené splátky',
    'Měsíční závazky včetně splátek',
    'Výplata proti mým výdajům',
    'současně vytvoří propojený výdaj v Příjmech a výdajích',
    'Živý náhled v aplikaci byl kvůli výkonu telefonu odstraněn'
  ]) assert.ok(manual.includes(text), `V manuálu chybí: ${text}`);
});

test('javascript interaktivního manuálu je syntakticky platný', () => {
  const scripts=[...manual.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match=>match[1]);
  assert.ok(scripts.length>0);
  for(const source of scripts) assert.doesNotThrow(()=>new Function(source));
});

test('manuál neobsahuje zastaralé tvrzení o vestavěném náhledu AI výkazu', () => {
  assert.equal(manual.includes('Před tiskem nebo stažením je vidět simulace PDF stránky'), false);
  assert.equal(manual.includes('letní nebo koncoroční období'), false);
});
