import { createImagePdf } from './electricity-pdf.js';
import { drawSchoolLogoOnHeader } from './school-logo-pdf.js';

const PAGE_WIDTH_PX=1240;
const PAGE_HEIGHT_PX=1754;
const MARGIN_X=72;
const CONTENT_WIDTH=PAGE_WIDTH_PX-(MARGIN_X*2);
const CONTENT_BOTTOM=PAGE_HEIGHT_PX-112;
const FOOTER_Y=PAGE_HEIGHT_PX-48;

function asNumber(value){
  const parsed=Number(value);
  return Number.isFinite(parsed)?parsed:0;
}

function formatHours(value){
  return `${asNumber(value).toLocaleString('cs-CZ',{maximumFractionDigits:1})} h`;
}

function formatDate(value){
  const date=value instanceof Date?value:new Date(value);
  return Number.isNaN(date.getTime())?'':date.toLocaleDateString('cs-CZ',{day:'numeric',month:'long',year:'numeric'});
}

function loadImage(src){
  return new Promise(resolve=>{
    if(!src||typeof Image==='undefined'){ resolve(null); return; }
    const image=new Image();
    image.onload=()=>resolve(image);
    image.onerror=()=>resolve(null);
    image.src=src;
  });
}

function base64ToBytes(base64){
  const binary=atob(base64);
  const bytes=new Uint8Array(binary.length);
  for(let index=0;index<binary.length;index+=1) bytes[index]=binary.charCodeAt(index);
  return bytes;
}

function canvasToJpegBytes(canvas){
  const dataUrl=canvas.toDataURL('image/jpeg',0.94);
  return base64ToBytes(dataUrl.slice(dataUrl.indexOf(',')+1));
}

function wrapText(ctx,value,maxWidth){
  const text=String(value||'').replace(/\r\n?/g,'\n').trim();
  if(!text) return [];
  const result=[];
  for(const paragraph of text.split('\n')){
    if(!paragraph.trim()){ result.push(''); continue; }
    let line='';
    for(const word of paragraph.trim().split(/\s+/)){
      const candidate=line?`${line} ${word}`:word;
      if(ctx.measureText(candidate).width<=maxWidth){ line=candidate; continue; }
      if(line) result.push(line);
      if(ctx.measureText(word).width<=maxWidth){ line=word; continue; }
      let fragment='';
      for(const character of word){
        if(ctx.measureText(fragment+character).width<=maxWidth) fragment+=character;
        else{ if(fragment) result.push(fragment); fragment=character; }
      }
      line=fragment;
    }
    if(line) result.push(line);
  }
  return result;
}

function roundRectPath(ctx,x,y,width,height,radius){
  const r=Math.min(radius,width/2,height/2);
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+width,y,x+width,y+height,r);
  ctx.arcTo(x+width,y+height,x,y+height,r);
  ctx.arcTo(x,y+height,x,y,r);
  ctx.arcTo(x,y,x+width,y,r);
  ctx.closePath();
}

function fillRoundRect(ctx,x,y,width,height,radius,color){
  roundRectPath(ctx,x,y,width,height,radius);
  ctx.fillStyle=color;
  ctx.fill();
}

function strokeRoundRect(ctx,x,y,width,height,radius,color,lineWidth=1){
  roundRectPath(ctx,x,y,width,height,radius);
  ctx.strokeStyle=color;
  ctx.lineWidth=lineWidth;
  ctx.stroke();
}

function drawFooter(ctx,pageNumber,version){
  ctx.strokeStyle='#d7e0ec';
  ctx.lineWidth=2;
  ctx.beginPath();
  ctx.moveTo(MARGIN_X,FOOTER_Y-24);
  ctx.lineTo(PAGE_WIDTH_PX-MARGIN_X,FOOTER_Y-24);
  ctx.stroke();
  ctx.fillStyle='#65738a';
  ctx.font='500 18px Arial, sans-serif';
  ctx.textAlign='left';
  ctx.fillText(`Podklady pro odměny · LifeHub ${version}`,MARGIN_X,FOOTER_Y);
  ctx.textAlign='right';
  ctx.fillText(`Strana ${pageNumber}`,PAGE_WIDTH_PX-MARGIN_X,FOOTER_Y);
  ctx.textAlign='left';
}

function drawMainHeader(ctx,{logo,ownerName,organization,periodLabel}){
  ctx.fillStyle='#082e67';
  ctx.fillRect(0,0,PAGE_WIDTH_PX,222);
  ctx.fillStyle='#cf2e3a';
  ctx.fillRect(0,212,PAGE_WIDTH_PX,10);
  if(logo) drawSchoolLogoOnHeader(ctx,logo,MARGIN_X,41);
  const left=logo?226:MARGIN_X;
  ctx.fillStyle='#ffffff';
  ctx.font='800 28px Arial, sans-serif';
  ctx.fillText('PODKLADY PRO ODMĚNY',left,80);
  ctx.font='600 21px Arial, sans-serif';
  ctx.fillStyle='#d9e8fb';
  ctx.fillText(ownerName,left,118);
  if(organization) ctx.fillText(organization,left,151);
  ctx.textAlign='right';
  ctx.fillStyle='#ffffff';
  ctx.font='800 44px Arial, sans-serif';
  ctx.fillText('Odměny',PAGE_WIDTH_PX-MARGIN_X,94);
  ctx.font='700 24px Arial, sans-serif';
  ctx.fillStyle='#d9e8fb';
  const periodLines=wrapText(ctx,periodLabel,480).slice(0,2);
  periodLines.forEach((line,index)=>ctx.fillText(line,PAGE_WIDTH_PX-MARGIN_X,134+(index*29)));
  ctx.textAlign='left';
}

function drawCompactHeader(ctx,pageNumber,periodLabel){
  ctx.fillStyle='#082e67';
  ctx.fillRect(0,0,PAGE_WIDTH_PX,112);
  ctx.fillStyle='#cf2e3a';
  ctx.fillRect(0,104,PAGE_WIDTH_PX,8);
  ctx.fillStyle='#ffffff';
  ctx.font='800 28px Arial, sans-serif';
  ctx.fillText('Podklady pro odměny',MARGIN_X,61);
  ctx.textAlign='right';
  ctx.font='500 19px Arial, sans-serif';
  ctx.fillText(`${periodLabel} · strana ${pageNumber}`,PAGE_WIDTH_PX-MARGIN_X,61);
  ctx.textAlign='left';
}

function drawSummary(ctx,{ownerName,periodLabel,itemCount,totalHours,generatedAt}){
  const rows=[
    ['Zpracoval',ownerName],
    ['Období',periodLabel],
    ['Počet položek',String(itemCount)],
    ['Celkem hodin',formatHours(totalHours)]
  ];
  const gap=18;
  const width=(CONTENT_WIDTH-(gap*3))/4;
  rows.forEach(([label,value],index)=>{
    const x=MARGIN_X+(index*(width+gap));
    fillRoundRect(ctx,x,254,width,108,18,index===3?'#eef9f1':'#f4f7fb');
    strokeRoundRect(ctx,x,254,width,108,18,index===3?'#b9dfc3':'#d7e0ec',2);
    ctx.fillStyle='#65738a';
    ctx.font='700 16px Arial, sans-serif';
    ctx.fillText(label.toUpperCase(),x+18,286);
    ctx.fillStyle=index===3?'#238a45':'#10213d';
    ctx.font='800 21px Arial, sans-serif';
    const lines=wrapText(ctx,value,width-36).slice(0,2);
    lines.forEach((line,lineIndex)=>ctx.fillText(line,x+18,321+(lineIndex*25)));
  });
  ctx.fillStyle='#1f5fbf';
  ctx.font='800 17px Arial, sans-serif';
  ctx.fillText('PRŮBĚŽNÁ EVIDENCE ČINNOSTÍ',MARGIN_X,410);
  ctx.fillStyle='#10213d';
  ctx.font='800 30px Arial, sans-serif';
  ctx.fillText('Vykazované položky za vybrané období',MARGIN_X,448);
  ctx.textAlign='right';
  ctx.fillStyle='#65738a';
  ctx.font='600 18px Arial, sans-serif';
  ctx.fillText(`Vygenerováno ${formatDate(generatedAt)}`,PAGE_WIDTH_PX-MARGIN_X,448);
  ctx.textAlign='left';
}

function prepareItemLines(ctx,item,continuation){
  ctx.font=continuation?'700 22px Arial, sans-serif':'800 25px Arial, sans-serif';
  const title=continuation?`${item.title} – pokračování`:item.title;
  const titleLines=wrapText(ctx,title,CONTENT_WIDTH-230);
  ctx.font='500 20px Arial, sans-serif';
  const noteLines=wrapText(ctx,item.note,CONTENT_WIDTH-52);
  return {titleLines,noteLines};
}

function itemBaseHeight(titleLineCount,noteLineCount){
  return 78+(titleLineCount*31)+(noteLineCount?(30+(noteLineCount*28)):0);
}

function drawItem(ctx,item,index,y,{continuation=false,noteLines=[]}={}){
  const {titleLines}=prepareItemLines(ctx,item,continuation);
  const height=itemBaseHeight(titleLines.length,noteLines.length);
  fillRoundRect(ctx,MARGIN_X,y,CONTENT_WIDTH,height,18,'#ffffff');
  strokeRoundRect(ctx,MARGIN_X,y,CONTENT_WIDTH,height,18,'#d7e0ec',2);
  ctx.fillStyle='#1f5fbf';
  ctx.fillRect(MARGIN_X,y+18,8,height-36);
  fillRoundRect(ctx,MARGIN_X+24,y+22,54,42,13,'#082e67');
  ctx.fillStyle='#ffffff';
  ctx.font='800 20px Arial, sans-serif';
  ctx.textAlign='center';
  ctx.fillText(String(index+1),MARGIN_X+51,y+50);
  ctx.textAlign='right';
  ctx.fillStyle='#238a45';
  ctx.font='800 24px Arial, sans-serif';
  ctx.fillText(formatHours(item.hours),PAGE_WIDTH_PX-MARGIN_X-24,y+51);
  ctx.textAlign='left';
  ctx.fillStyle='#10213d';
  ctx.font=continuation?'700 22px Arial, sans-serif':'800 25px Arial, sans-serif';
  let cursorY=y+98;
  titleLines.forEach(line=>{ctx.fillText(line,MARGIN_X+24,cursorY);cursorY+=31;});
  if(noteLines.length){
    ctx.strokeStyle='#e4eaf2';
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(MARGIN_X+24,cursorY-14);
    ctx.lineTo(PAGE_WIDTH_PX-MARGIN_X-24,cursorY-14);
    ctx.stroke();
    ctx.fillStyle='#33435d';
    ctx.font='500 20px Arial, sans-serif';
    cursorY+=12;
    noteLines.forEach(line=>{ctx.fillText(line||' ',MARGIN_X+24,cursorY);cursorY+=28;});
  }
  return height;
}

function drawSignatures(ctx,y,ownerName){
  const width=(CONTENT_WIDTH-80)/2;
  const labels=[[ownerName,'zpracoval'],['','vedení školy']];
  labels.forEach(([name,label],index)=>{
    const x=MARGIN_X+(index*(width+80));
    ctx.strokeStyle='#8fa0b6';
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(x,y+54);
    ctx.lineTo(x+width,y+54);
    ctx.stroke();
    ctx.fillStyle='#10213d';
    ctx.font='700 20px Arial, sans-serif';
    if(name) ctx.fillText(name,x,y+84);
    ctx.fillStyle='#65738a';
    ctx.font='600 16px Arial, sans-serif';
    ctx.fillText(label.toUpperCase(),x,y+108);
  });
  return 126;
}

async function renderPages(items,options){
  const logo=await loadImage(options.logoDataUrl);
  const pages=[];
  let canvas;
  let ctx;
  let y;
  let pageNumber=0;
  const newPage=first=>{
    canvas=document.createElement('canvas');
    canvas.width=PAGE_WIDTH_PX;
    canvas.height=PAGE_HEIGHT_PX;
    ctx=canvas.getContext('2d',{alpha:false});
    ctx.fillStyle='#ffffff';
    ctx.fillRect(0,0,PAGE_WIDTH_PX,PAGE_HEIGHT_PX);
    pageNumber+=1;
    if(first){
      drawMainHeader(ctx,{logo,ownerName:options.ownerName,organization:options.organization,periodLabel:options.periodLabel});
      drawSummary(ctx,{ownerName:options.ownerName,periodLabel:options.periodLabel,itemCount:items.length,totalHours:items.reduce((sum,item)=>sum+item.hours,0),generatedAt:options.generatedAt});
      y=486;
    }else{
      drawCompactHeader(ctx,pageNumber,options.periodLabel);
      y=146;
    }
  };
  const savePage=()=>{
    drawFooter(ctx,pageNumber,options.version);
    pages.push(canvasToJpegBytes(canvas));
  };

  newPage(true);
  if(!items.length){
    fillRoundRect(ctx,MARGIN_X,y,CONTENT_WIDTH,150,18,'#f7f9fc');
    strokeRoundRect(ctx,MARGIN_X,y,CONTENT_WIDTH,150,18,'#d7e0ec',2);
    ctx.fillStyle='#65738a';
    ctx.font='600 25px Arial, sans-serif';
    ctx.textAlign='center';
    ctx.fillText('V tomto období zatím nejsou žádné položky.',PAGE_WIDTH_PX/2,y+84);
    ctx.textAlign='left';
    y+=180;
  }

  items.forEach((item,index)=>{
    let continuation=false;
    let remaining;
    ctx.font='500 20px Arial, sans-serif';
    remaining=wrapText(ctx,item.note,CONTENT_WIDTH-52);
    let rendered=false;
    while(!rendered||remaining.length){
      const prepared=prepareItemLines(ctx,item,continuation);
      const base=itemBaseHeight(prepared.titleLines.length,0);
      let capacity=Math.max(0,Math.floor((CONTENT_BOTTOM-y-base-30)/28));
      if((remaining.length&&capacity===0)||(!remaining.length&&base>CONTENT_BOTTOM-y)){
        savePage();
        newPage(false);
        capacity=Math.max(0,Math.floor((CONTENT_BOTTOM-y-itemBaseHeight(prepareItemLines(ctx,item,continuation).titleLines.length,0)-30)/28));
      }
      const chunk=remaining.slice(0,capacity);
      const height=drawItem(ctx,item,index,y,{continuation,noteLines:chunk});
      y+=height+18;
      remaining=remaining.slice(chunk.length);
      continuation=true;
      rendered=true;
      if(remaining.length){ savePage(); newPage(false); }
    }
  });

  if(CONTENT_BOTTOM-y<150){ savePage(); newPage(false); }
  y+=drawSignatures(ctx,y,options.ownerName);
  savePage();
  return pages;
}

export async function buildRewardPdfBlob(items,{logoDataUrl='',ownerName='Daniel Baláž',organization='',periodLabel='Vybrané období',generatedAt=new Date(),version=''}={}){
  const normalized=(Array.isArray(items)?items:[]).map(item=>({
    title:String(item?.title||'Bez názvu').trim()||'Bez názvu',
    note:String(item?.note||'').trim(),
    hours:Math.max(0,asNumber(item?.hours)),
    createdAt:String(item?.createdAt||''),
    updatedAt:String(item?.updatedAt||'')
  })).sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt))||a.title.localeCompare(b.title,'cs'));
  const jpegPages=await renderPages(normalized,{logoDataUrl,ownerName,organization,periodLabel,generatedAt,version});
  const pdfBytes=createImagePdf(jpegPages);
  return new Blob([pdfBytes],{type:'application/pdf'});
}
