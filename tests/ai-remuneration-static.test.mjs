import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../src/app/lifehub-app.js', import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html', import.meta.url),'utf8');

test('AI odměňování má strukturovaná pole a oddělenou soukromou poznámku',()=>{
  for(const id of ['aiCategory','aiApp','aiWorkType','aiActivity','aiNote','aiPrivateNote','aiSummaryResults','aiSummaryRisks','aiSummaryDecisions','aiSummaryPriorities']) assert.match(html,new RegExp(`id="${id}"`));
  assert.match(app,/privateNote:\$\('#aiPrivateNote'\)\.value\.trim\(\)/);
});

test('report pro vedení neobsahuje značku LifeHub ani soukromou poznámku',()=>{
  const start=app.indexOf('function buildAiReportHtml');
  const end=app.indexOf('function buildRewardReportHtml',start);
  const block=app.slice(start,end);
  assert.doesNotMatch(block,/LifeHub/i);
  assert.doesNotMatch(block,/privateNote/);
  assert.match(block,/Měsíční report činností v oblasti AI/);
  assert.match(block,/Pracovní zařazení/);
  assert.match(block,/>Pedagog</);
});

test('modul Odměny zůstává oddělený',()=>{
  assert.match(html,/id="rewards"/);
  assert.match(app,/function saveReward/);
  assert.doesNotMatch(app,/state\.rewards.*state\.aiEntries|state\.aiEntries.*state\.rewards/);
});
