import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const manual = fs.readFileSync(new URL('../public/manual.html', import.meta.url), 'utf8');

test('interaktivní manuál odpovídá funkcím LifeHubu 5.2.1', () => {
  for (const text of [
    'LifeHub 5.2.1',
    'Moje Fabia',
    'Škodu Fabia I 1.2 HTP',
    'Garanční servis',
    'STK + emise',
    'Započítat do finanční evidence',
    'Z poslední výplaty zbývá',
    'skutečným připsáním mzdy',
    'skutečného data pohybu',
    'bez dvojího zapisování',
    'Jídlo & benzín',
    'Zaplatila manželka',
    'Náklady domácnosti',
    'Plány a postupy',
    'Projekty domu',
    'Elektřina – Marek',
    'Servis a údržba',
    'bezpečně odděleném sandboxu',
    'kompletní šifrovanou zálohu',
    'kompletní historii Fabie',
    'Uvidí manželka kompletní historii Fabie?'
  ]) assert.ok(manual.includes(text), `V manuálu chybí: ${text}`);

  const modules=manual.split('const modules = [',2)[1]?.split('];',1)[0]||'';
  assert.equal((modules.match(/\{id:'/g)||[]).length,23);
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
