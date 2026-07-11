import test from 'node:test';
import assert from 'node:assert/strict';
import { parseElanorPayslip, isElanorPayslip, collapseSpacedCaps, parseElanorAmount } from '../src/features/payroll-elanor.js';

// Reálná extrakce PDF.js z pásky 05/2026 (formát 4 sloupců „popisek hodnota" na řádek)
const MAY = 'Gym., Ostrava-Hrabůvka Vytvořeno: 11.7.2026 8:28\nVyp11 Strana 1 / 1\nVýplatní lístek\nPříjmení a jméno: Období Středisko:\nBaláž Daniel Mgr. 2026-05 002 Pedagogové\nPV 1134.01\nSměny MR Hodiny\nPlat 39 910,00 Dovolená nárok 0,00 320,00 Úvazek 40,000\nOstatní tarifní složky 1 000,00 Dovolená čerpání 0,00 0,00 Org.středisko 002\nPrům.náhrady (hod.) 253,09 Dovolená krácení 0,00 Fond směn 21,00\nDovolená zůstatek 0,00 320,00 Fond hodin 168,00\nZůst. směn orient. 40,0\nPV 1134.02\nSměny MR Hodiny\nPlat 360,00 Dovolená nárok 0,00 0,00 Úvazek 0,000\nOstatní tarifní složky 0,00 Dovolená čerpání 0,00 0,00 Org.středisko 002\nPrům.náhrady (hod.) 0,00 Dovolená krácení 0,00 Fond směn\nDovolená zůstatek 0,00 0,00 Fond hodin\nZůst. směn orient. 0,0\nSLM OSČPV Hodiny Kal.dny Směny Částka\n40 1134.01 Fond svátku 16,00 2,00 2,00 0,00\n510 1134.01 Nemoc 32,00 4,00 4,00 0,00\n11210 1134.01 Měsíční plat 136,00 27,00 17,00 32 308,00\n11220 1134.01 Osobní příplatek 136,00 27,00 17,00 810,00\n22610 1134.01 Náhrady příjmu při nemoci 32,00 4,00 4,00 4 374,00\n30110 1134.01 CZ Vyměř základ SZ 0,00 0,00 0,00 33 118,00\n30210 1134.01 CZ Vyměř zaklad ZP 0,00 0,00 0,00 33 118,00\n41064 1134.01 Stravenky/Závodní stravování přes hranici 0,00 0,00 0,00 532,00\n51024 1134.01 Stravování – příspěvek z FKSP 0,00 0,00 0,00 728,00\n55330 1134.01 Poskytnuté benefity - celkem od začátku 0,00 0,00 0,00 0,00\n21320 1134.02 DPP 3,00 0,00 0,00 1 080,00\nOdprac.hodiny 139,00 Zdan.příjem 34 198 Sleva základní 2 570 Hrubá mzda 34 198\nOdprac.směny 17,00 Poj. pro daň 0 Sleva invalidita 0 Hrubý příjem 39 300\nNeodprac.směny 4,00 Srážková daň 0 Sleva na děti 2 560 Čistá mzda 30 355\nSZ zaměstnanec 2 352 Základ daně 34 198 Daňový bonus 567 Z Á L O H A 0\nZP zaměstnanec 1 491 Daň stanovená 5 130 Zálohová daň 0 D O B Í R K A 34 764\n211-Zdravotní pojišťovna Ministerstva vnitra\nSystém Elanor Global Java Edition - Elanor a.s.';

// Syntetická páska 02/2026 ve stejném rozložení – testuje záporné náhrady nemoci a nenulovou daň
const FEB = 'Gym., Ostrava-Hrabůvka Vytvořeno: 6.3.2026 9:12\nVyp11 Strana 1 / 1\nVýplatní lístek\nPříjmení a jméno: Období Středisko:\nBaláž Daniel Mgr. 2026-02 002 Pedagogové\nSLM OSČPV Hodiny Kal.dny Směny Částka\n11210 1134.01 Měsíční plat 128,00 25,00 16,00 31 747,00\n11220 1134.01 Osobní příplatek 128,00 25,00 16,00 795,00\n11290 1134.01 Přípl.za přímou pedag.čin.nad rozsah 8,00 0,00 0,00 2 825,00\n22610 1134.01 Náhrady příjmu při nemoci 0,00 0,00 0,00 -1 429,00\n41064 1134.01 Stravenky/Závodní stravování přes hranici 0,00 0,00 0,00 570,00\n21320 1134.02 DPP 3,00 0,00 0,00 1 080,00\nOdprac.hodiny 131,00 Zdan.příjem 46 675 Sleva základní 2 570 Hrubá mzda 46 675\nOdprac.směny 16,00 Poj. pro daň 0 Sleva invalidita 0 Hrubý příjem 45 246\nNeodprac.směny -1,00 Srážková daň 0 Sleva na děti 3 127 Čistá mzda 40 077\nSZ zaměstnanec 3 238 Základ daně 46 675 Daňový bonus 0 Z Á L O H A 0\nZP zaměstnanec 2 052 Daň stanovená 7 005 Zálohová daň 1 308 D O B Í R K A 38 078\nSystém Elanor Global Java Edition - Elanor a.s.';

test('collapseSpacedCaps spojí proložené kapitálky', () => {
  assert.equal(collapseSpacedCaps('D O B Í R K A 34 764'), 'DOBÍRKA 34 764');
  assert.equal(collapseSpacedCaps('Z Á L O H A 0'), 'ZÁLOHA 0');
  assert.equal(collapseSpacedCaps('SZ zaměstnanec 2 352'), 'SZ zaměstnanec 2 352');
});

test('parseElanorAmount čte české částky včetně záporných', () => {
  assert.equal(parseElanorAmount('34 198'), 34198);
  assert.equal(parseElanorAmount('-1 429,00'), -1429);
  assert.equal(parseElanorAmount('139,00'), 139);
  assert.equal(parseElanorAmount('abc'), null);
});

test('detekce pásky Elanor', () => {
  assert.equal(isElanorPayslip(MAY), true);
  assert.equal(isElanorPayslip('Běžný text bez výplatního lístku'), false);
});

test('páska 05/2026: všechna pole ze souhrnu i položek', () => {
  const r = parseElanorPayslip(MAY);
  assert.equal(r.month, '2026-05');
  assert.equal(r.employer, 'Gym., Ostrava-Hrabůvka');
  assert.deepEqual(r.fields, {
    netPay: 34764, grossPay: 34198, taxBase: 34198, taxpayerDiscount: 2570,
    socialInsurance: 2352, healthInsurance: 1491, workedHours: 139,
    incomeTax: 0, childDiscount: 3127, sickPay: 4374, mealVouchers: 532
  });
  assert.ok(r.found >= 11);
  assert.ok(r.hints.some(h => h.includes('DPP')));
  assert.ok(r.hints.some(h => h.includes('čistá mzda 30 355')));
  assert.equal(r.evidence.netPay.label, 'DOBÍRKA (částka na účet)');
});

test('páska 02/2026: záporné náhrady nemoci, daň a příplatek', () => {
  const r = parseElanorPayslip(FEB);
  assert.equal(r.month, '2026-02');
  assert.equal(r.fields.netPay, 38078);
  assert.equal(r.fields.grossPay, 46675);
  assert.equal(r.fields.incomeTax, 1308);
  assert.equal(r.fields.childDiscount, 3127);
  assert.equal(r.fields.sickPay, -1429);
  assert.equal(r.fields.overtime, 2825);
  assert.equal(r.fields.mealVouchers, 570);
  assert.equal(r.fields.socialInsurance, 3238);
  assert.equal(r.fields.healthInsurance, 2052);
});
