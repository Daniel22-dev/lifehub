import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildElectricityPdfBlob, createImagePdf } from '../src/features/electricity-pdf.js';

const app = fs.readFileSync(new URL('../src/app/lifehub-app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const moduleSource = fs.readFileSync(new URL('../src/features/electricity-pdf.js', import.meta.url), 'utf8');

test('elektrikářský export nabízí pouze přímé stažení PDF', () => {
  const start = html.indexOf('id="electricityPdfBtn"');
  assert.ok(start > -1);
  const section = html.slice(html.lastIndexOf('<section class="view" id="electricity"', start), html.indexOf('</section>', start));
  assert.ok(section.includes('Stáhnout PDF pro Honzu Marka'));
  assert.equal(section.includes('Export CSV'), false);
  assert.equal(section.includes('tiskovém dialogu'), false);
  assert.equal(section.includes('id="printReport"'), false);
});

test('tlačítko elektřiny nepoužívá tiskovou vrstvu aplikace', () => {
  assert.ok(app.includes("$('#electricityPdfBtn')?.addEventListener('click',downloadElectricityReportPdf)"));
  assert.ok(app.includes('buildElectricityPdfBlob(state.electricalNotes'));
  assert.equal(app.includes('printReport(buildElectricityReportHtml())'), false);
  assert.equal(app.includes('function buildElectricityReportHtml()'), false);
});

test('PDF generátor je lokální, vícestránkový a bez externí knihovny', () => {
  assert.ok(moduleSource.includes("new Blob([pdfBytes], {type:'application/pdf'})"));
  assert.ok(moduleSource.includes('/Type /Pages'));
  assert.ok(moduleSource.includes('/Filter /DCTDecode'));
  assert.ok(moduleSource.includes('renderPages(normalized, options)'));
  assert.equal(moduleSource.includes('https://'), false);
});

test('nízkoúrovňový generátor vytvoří platnou PDF obálku', () => {
  const fakeJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const pdf = createImagePdf([fakeJpeg]);
  const text = new TextDecoder('latin1').decode(pdf);
  assert.ok(text.startsWith('%PDF-1.4'));
  assert.ok(text.includes('/Type /Catalog'));
  assert.ok(text.includes('/Count 1'));
  assert.ok(text.includes('xref'));
  assert.ok(text.endsWith('%%EOF'));
});


test('vyšší počet dlouhých položek vytvoří jeden vícestránkový PDF soubor', async () => {
  const originalDocument = globalThis.document;
  const context = {
    beginPath(){}, moveTo(){}, arcTo(){}, closePath(){}, fill(){}, stroke(){},
    fillRect(){}, drawImage(){}, fillText(){}, lineTo(){},
    measureText(value){ return {width:String(value || '').length * 10}; },
    fillStyle:'', strokeStyle:'', lineWidth:1, font:'', textAlign:'left'
  };
  globalThis.document = {
    createElement(name){
      assert.equal(name, 'canvas');
      return {
        width:0,
        height:0,
        getContext(){ return context; },
        toDataURL(){ return 'data:image/jpeg;base64,/9j/2Q=='; }
      };
    }
  };
  try{
    const items = Array.from({length:14}, (_, index) => ({
      type:index % 3 === 0 ? 'material' : index % 3 === 1 ? 'idea' : 'note',
      title:`Položka ${index + 1} – zásuvky a přívodní kabel`,
      description:'Příliš žluťoučký kůň úpěl ďábelské ódy. '.repeat(18),
      date:`2026-08-${String((index % 28) + 1).padStart(2, '0')}`,
      price:index % 3 === 0 ? 1250 + index : 0,
      url:'https://example.com/technicky-podklad'
    }));
    const blob = await buildElectricityPdfBlob(items, {
      ownerName:'Daniel Baláž',
      recipientName:'Honza Marek',
      generatedAt:new Date('2026-08-03T12:00:00Z')
    });
    assert.equal(blob.type, 'application/pdf');
    const text = new TextDecoder('latin1').decode(await blob.arrayBuffer());
    const pageCount = Number(text.match(/\/Count (\d+)/)?.[1] || 0);
    assert.ok(pageCount > 1, `očekáván vícestránkový dokument, vzniklo ${pageCount} stran`);
    assert.equal((text.match(/\/Type \/Page\b/g) || []).length, pageCount);
  }finally{
    if(originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});
