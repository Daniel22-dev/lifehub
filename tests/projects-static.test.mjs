import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const app=await readFile(new URL('../src/app/lifehub-app.js',import.meta.url),'utf8');
const css=await readFile(new URL('../src/styles/lifehub.css',import.meta.url),'utf8');

test('LifeHub má úplné projektové centrum', () => {
  for(const text of ['data-tab="projects"','id="projects"','id="projectForm"','id="projectCostForm"','id="projectAttachmentInput"','id="projectSketchStudio"']){
    assert.ok(html.includes(text),`Chybí ${text}`);
  }
  for(const text of ['function renderProjects','function saveProject','function addProjectAttachments','function saveProjectSketch','function exportSelectedProjectMarkdown','function exportSelectedProjectCsv']){
    assert.ok(app.includes(text),`Chybí ${text}`);
  }
  assert.match(css,/\.project-grid/);
  assert.match(css,/\.sketch-studio/);
});

test('projektové přílohy jsou součástí kompletní zálohy', () => {
  assert.ok(app.includes("projectAttachmentMetadata(state.projects)"));
  assert.ok(app.includes("'projectAttachment'"));
  assert.ok(app.includes('projectFileCount'));
});
