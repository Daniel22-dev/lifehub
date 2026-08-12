import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { noteAttachmentKind, noteAttachmentMetadata } from '../src/features/note-attachments.js';

const app=fs.readFileSync(new URL('../src/app/lifehub-app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('poznámka přijímá pouze PDF, DOCX a interaktivní HTML', () => {
  assert.equal(noteAttachmentKind({name:'podklad.pdf',type:''}),'pdf');
  assert.equal(noteAttachmentKind({name:'metodika.docx',type:''}),'docx');
  assert.equal(noteAttachmentKind({name:'aktivita.html',type:'text/html'}),'html');
  assert.equal(noteAttachmentKind({name:'tabulka.xlsx',type:''}),'');
  assert.ok(html.includes('id="noteAttachmentInput"'));
  assert.ok(html.includes('.pdf,.docx,.html,.htm'));
});

test('metadata příloh poznámek lze zahrnout do šifrované kompletní zálohy', () => {
  const rows=noteAttachmentMetadata([{id:'n1',title:'Výuka',attachments:[{id:'f1',fileName:'aktivita.html',kind:'html',storedFile:true}]}]);
  assert.equal(rows.length,1);
  assert.equal(rows[0].noteId,'n1');
  assert.equal(rows[0].noteTitle,'Výuka');
  assert.ok(app.includes("'noteAttachment'"));
  assert.ok(app.includes('imported.notes.forEach'));
});

test('HTML příloha se otevírá v odděleném prohlížeči bez přístupu k LifeHubu', () => {
  assert.ok(app.includes('function openInteractiveNoteHtml'));
  assert.ok(app.includes('src="./plan-viewer.html?note='));
  assert.ok(app.includes('sandbox="allow-scripts allow-forms allow-modals allow-downloads"'));
});
