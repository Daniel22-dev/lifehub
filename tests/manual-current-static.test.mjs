import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const manual = fs.readFileSync(new URL('../public/manual.html', import.meta.url), 'utf8');

test('interaktivní manuál odpovídá funkcím LifeHubu 4.8.6', () => {
  for (const text of [
    'LifeHub 4.8.6',
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
    'Výplata proti celému měsíci',
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
