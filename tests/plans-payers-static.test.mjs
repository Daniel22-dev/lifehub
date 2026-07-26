import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../src/app/lifehub-app.js',import.meta.url),'utf8');
const viewer=fs.readFileSync(new URL('../public/plan-viewer.html',import.meta.url),'utf8');
const stateIntegrity=fs.readFileSync(new URL('../src/core/state-integrity.js',import.meta.url),'utf8');

 test('Plány a postupy jsou samostatná záložka a Projekty domu zůstávají zachované',()=>{
  assert.ok(html.includes('data-tab="projects"'));
  assert.ok(html.includes('data-tab="plans"'));
  assert.ok(html.includes('id="plans"'));
  assert.ok(html.includes('Plány a postupy'));
  assert.equal(html.includes('Stavební projekty'),false);
});

test('HTML plány se ukládají do trezoru a bezpečně otevírají v sandboxu',()=>{
  assert.ok(app.includes('async function saveHtmlPlan'));
  assert.ok(app.includes("await idbPut(id,file,VAULT_STORE)"));
  assert.ok(app.includes("role,'htmlPlan'" ) || app.includes("'htmlPlan'"));
  assert.ok(html.includes('sandbox="allow-scripts allow-forms allow-modals allow-downloads"'));
  assert.ok(viewer.includes("connect-src 'none'"));
  assert.ok(viewer.includes("object-src 'none'"));
  assert.equal(viewer.includes('allow-same-origin'),false);
});

test('datový model obsahuje plány a plátce výdajů',()=>{
  assert.ok(stateIntegrity.includes("'projects','htmlPlans'"));
  assert.ok(stateIntegrity.includes('row.paidBy=normalizePayer'));
  assert.ok(stateIntegrity.includes('row.defaultPaidBy=normalizePayer'));
  assert.ok(html.includes('id="maintenancePaidBy"'));
  assert.ok(html.includes('id="financePayerView"'));
  assert.ok(app.includes("payerLabel"));
});
