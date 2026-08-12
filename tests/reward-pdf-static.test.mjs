import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildRewardPdfBlob } from '../src/features/reward-pdf.js';

const app=fs.readFileSync(new URL('../src/app/lifehub-app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('odměny stahují skutečné PDF bez tiskového dialogu', () => {
  const start=html.indexOf('id="rewardPrintBtn"');
  assert.ok(start>-1);
  assert.ok(html.slice(start,start+180).includes('Stáhnout PDF'));
  assert.ok(app.includes("$('#rewardPrintBtn')?.addEventListener('click',downloadRewardReportPdf)"));
  assert.ok(app.includes('buildRewardPdfBlob(state.rewards.filter'));
  assert.equal(app.includes("printReport(buildRewardReportHtml(selectedRewardPeriod()))"),false);
});

test('generátor odměn vytvoří lokální vícestránkový PDF soubor', async () => {
  const originalDocument=globalThis.document;
  const context={
    beginPath(){},moveTo(){},arcTo(){},closePath(){},fill(){},stroke(){},fillRect(){},drawImage(){},fillText(){},lineTo(){},
    measureText(value){return {width:String(value||'').length*10};},
    fillStyle:'',strokeStyle:'',lineWidth:1,font:'',textAlign:'left'
  };
  globalThis.document={createElement(name){
    assert.equal(name,'canvas');
    return {width:0,height:0,getContext(){return context;},toDataURL(){return 'data:image/jpeg;base64,/9j/2Q==';}};
  }};
  try{
    const items=Array.from({length:18},(_,index)=>({title:`Činnost ${index+1}`,hours:1.5,note:'Podrobný popis vykonané práce a jejího výsledku. '.repeat(12),createdAt:`2026-01-${String((index%28)+1).padStart(2,'0')}`}));
    const blob=await buildRewardPdfBlob(items,{ownerName:'Daniel Baláž',organization:'Gymnázium',periodLabel:'Leden–červen 2026',generatedAt:new Date('2026-08-12T12:00:00Z'),version:'5.4.0'});
    assert.equal(blob.type,'application/pdf');
    const text=new TextDecoder('latin1').decode(await blob.arrayBuffer());
    const pageCount=Number(text.match(/\/Count (\d+)/)?.[1]||0);
    assert.ok(pageCount>1);
    assert.equal((text.match(/\/Type \/Page\b/g)||[]).length,pageCount);
  }finally{
    if(originalDocument===undefined) delete globalThis.document;
    else globalThis.document=originalDocument;
  }
});
