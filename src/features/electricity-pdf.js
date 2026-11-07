import { drawSchoolLogoOnHeader } from './school-logo-pdf.js';

const PAGE_WIDTH_PX = 1240;
const PAGE_HEIGHT_PX = 1754;
const PAGE_WIDTH_PT = 595.28;
const PAGE_HEIGHT_PT = 841.89;
const MARGIN_X = 72;
const CONTENT_WIDTH = PAGE_WIDTH_PX - (MARGIN_X * 2);
const FOOTER_Y = PAGE_HEIGHT_PX - 48;
const CONTENT_BOTTOM = PAGE_HEIGHT_PX - 92;

const TYPE_LABELS = {
  note: 'Poznámka',
  idea: 'Nápad',
  material: 'Materiál'
};

const TYPE_COLORS = {
  note: '#315f93',
  idea: '#a66a12',
  material: '#24764a'
};

const TYPE_BACKGROUNDS = {
  note: '#edf3fa',
  idea: '#fbf3e7',
  material: '#eaf6ef'
};

function asNumber(value){
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value){
  if(!value) return 'Bez data';
  let date;
  if(value instanceof Date) date = value;
  else{
    const text = String(value);
    date = /^\d{4}-\d{2}-\d{2}/.test(text)
      ? new Date(`${text.slice(0,10)}T00:00:00`)
      : new Date(text);
  }
  if(Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('cs-CZ', {day:'numeric', month:'long', year:'numeric'});
}

function formatCurrency(value){
  return new Intl.NumberFormat('cs-CZ', {style:'currency', currency:'CZK', maximumFractionDigits:0}).format(asNumber(value));
}

function roundRectPath(ctx, x, y, width, height, radius){
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function fillRoundRect(ctx, x, y, width, height, radius, fillStyle){
  roundRectPath(ctx, x, y, width, height, radius);
  ctx.fillStyle = fillStyle;
  ctx.fill();
}

function strokeRoundRect(ctx, x, y, width, height, radius, strokeStyle, lineWidth = 1){
  roundRectPath(ctx, x, y, width, height, radius);
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function wrapText(ctx, value, maxWidth){
  const text = String(value || '').replace(/\r\n?/g, '\n').trim();
  if(!text) return [];
  const result = [];
  for(const paragraph of text.split('\n')){
    if(!paragraph.trim()){
      result.push('');
      continue;
    }
    const words = paragraph.trim().split(/\s+/);
    let line = '';
    for(const word of words){
      const candidate = line ? `${line} ${word}` : word;
      if(ctx.measureText(candidate).width <= maxWidth){
        line = candidate;
        continue;
      }
      if(line) result.push(line);
      if(ctx.measureText(word).width <= maxWidth){
        line = word;
        continue;
      }
      let fragment = '';
      for(const character of word){
        const fragmentCandidate = fragment + character;
        if(ctx.measureText(fragmentCandidate).width <= maxWidth) fragment = fragmentCandidate;
        else{
          if(fragment) result.push(fragment);
          fragment = character;
        }
      }
      line = fragment;
    }
    if(line) result.push(line);
  }
  return result;
}

function loadImage(src){
  return new Promise(resolve => {
    if(!src){ resolve(null); return; }
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function base64ToBytes(base64){
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for(let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function canvasToJpegBytes(canvas){
  const dataUrl = canvas.toDataURL('image/jpeg', 0.94);
  return base64ToBytes(dataUrl.slice(dataUrl.indexOf(',') + 1));
}

function concatBytes(chunks){
  const size = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(size);
  let offset = 0;
  for(const chunk of chunks){
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

export function createImagePdf(jpegPages, widthPx = PAGE_WIDTH_PX, heightPx = PAGE_HEIGHT_PX){
  if(!Array.isArray(jpegPages) || !jpegPages.length) throw new Error('PDF nemá žádnou stránku.');
  const encoder = new TextEncoder();
  const chunks = [];
  const offsets = [0];
  let byteLength = 0;
  const append = value => {
    const bytes = typeof value === 'string' ? encoder.encode(value) : value;
    chunks.push(bytes);
    byteLength += bytes.length;
  };
  const startObject = id => {
    offsets[id] = byteLength;
    append(`${id} 0 obj\n`);
  };
  const endObject = () => append('endobj\n');

  append(new Uint8Array([0x25,0x50,0x44,0x46,0x2d,0x31,0x2e,0x34,0x0a,0x25,0xff,0xff,0xff,0xff,0x0a]));

  startObject(1);
  append('<< /Type /Catalog /Pages 2 0 R >>\n');
  endObject();

  const pageObjectIds = jpegPages.map((_, index) => 3 + (index * 3));
  startObject(2);
  append(`<< /Type /Pages /Count ${jpegPages.length} /Kids [${pageObjectIds.map(id => `${id} 0 R`).join(' ')}] >>\n`);
  endObject();

  jpegPages.forEach((jpeg, index) => {
    const pageId = 3 + (index * 3);
    const imageId = pageId + 1;
    const contentId = pageId + 2;
    startObject(pageId);
    append(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH_PT} ${PAGE_HEIGHT_PT}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>\n`);
    endObject();

    startObject(imageId);
    append(`<< /Type /XObject /Subtype /Image /Width ${widthPx} /Height ${heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
    append(jpeg);
    append('\nendstream\n');
    endObject();

    const content = `q\n${PAGE_WIDTH_PT} 0 0 ${PAGE_HEIGHT_PT} 0 0 cm\n/Im0 Do\nQ\n`;
    startObject(contentId);
    append(`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream\n`);
    endObject();
  });

  const xrefOffset = byteLength;
  append(`xref\n0 ${offsets.length}\n`);
  append('0000000000 65535 f \n');
  for(let id = 1; id < offsets.length; id += 1){
    append(`${String(offsets[id] || 0).padStart(10,'0')} 00000 n \n`);
  }
  append(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  return concatBytes(chunks);
}

function drawFooter(ctx, pageNumber){
  ctx.strokeStyle = '#d7e0ec';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(MARGIN_X, FOOTER_Y - 24);
  ctx.lineTo(PAGE_WIDTH_PX - MARGIN_X, FOOTER_Y - 24);
  ctx.stroke();
  ctx.fillStyle = '#65738a';
  ctx.font = '500 18px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Pracovní podklad z aplikace LifeHub', MARGIN_X, FOOTER_Y);
  ctx.textAlign = 'right';
  ctx.fillText(`Strana ${pageNumber}`, PAGE_WIDTH_PX - MARGIN_X, FOOTER_Y);
  ctx.textAlign = 'left';
}

function drawMainHeader(ctx, logo, ownerName, recipientName){
  ctx.fillStyle = '#082e67';
  ctx.fillRect(0, 0, PAGE_WIDTH_PX, 214);
  ctx.fillStyle = '#cf2e3a';
  ctx.fillRect(0, 204, PAGE_WIDTH_PX, 10);
  if(logo) drawSchoolLogoOnHeader(ctx,logo,MARGIN_X,36);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 27px Arial, sans-serif';
  ctx.fillText('PODKLADY PRO ELEKTROINSTALACI', logo ? 226 : MARGIN_X, 76);
  ctx.font = '500 21px Arial, sans-serif';
  ctx.fillStyle = '#d9e8fb';
  ctx.fillText(`Připravil: ${ownerName}`, logo ? 226 : MARGIN_X, 113);
  ctx.fillText(`Pro: ${recipientName}`, logo ? 226 : MARGIN_X, 146);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 44px Arial, sans-serif';
  ctx.fillText('Elektřina', PAGE_WIDTH_PX - MARGIN_X, 100);
  ctx.font = '700 30px Arial, sans-serif';
  ctx.fillStyle = '#d9e8fb';
  ctx.fillText('přehled podkladů', PAGE_WIDTH_PX - MARGIN_X, 143);
  ctx.textAlign = 'left';
}

function drawCompactHeader(ctx, pageNumber, recipientName){
  ctx.fillStyle = '#082e67';
  ctx.fillRect(0, 0, PAGE_WIDTH_PX, 112);
  ctx.fillStyle = '#cf2e3a';
  ctx.fillRect(0, 104, PAGE_WIDTH_PX, 8);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 28px Arial, sans-serif';
  ctx.fillText('Elektřina – přehled podkladů', MARGIN_X, 61);
  ctx.textAlign = 'right';
  ctx.font = '500 20px Arial, sans-serif';
  ctx.fillStyle = '#d9e8fb';
  ctx.fillText(`${recipientName} · strana ${pageNumber}`, PAGE_WIDTH_PX - MARGIN_X, 61);
  ctx.textAlign = 'left';
}

function drawSummary(ctx, items, generatedAt){
  const materialItems = items.filter(item => item.type === 'material');
  const total = materialItems.reduce((sum, item) => sum + asNumber(item.price), 0);
  const data = [
    ['Vygenerováno', formatDate(generatedAt)],
    ['Počet položek', String(items.length)],
    ['Materiálové položky', String(materialItems.length)],
    ['Odhad materiálu', formatCurrency(total)]
  ];
  const gap = 18;
  const width = (CONTENT_WIDTH - (gap * 3)) / 4;
  data.forEach(([label, value], index) => {
    const x = MARGIN_X + (index * (width + gap));
    fillRoundRect(ctx, x, 246, width, 102, 18, index === 3 ? '#eef9f1' : '#f4f7fb');
    strokeRoundRect(ctx, x, 246, width, 102, 18, index === 3 ? '#b9dfc3' : '#d7e0ec', 2);
    ctx.fillStyle = '#65738a';
    ctx.font = '700 16px Arial, sans-serif';
    ctx.fillText(label.toUpperCase(), x + 18, 278);
    ctx.fillStyle = index === 3 ? '#238a45' : '#10213d';
    ctx.font = '800 23px Arial, sans-serif';
    const fitted = value.length > 23 ? `${value.slice(0,22)}…` : value;
    ctx.fillText(fitted, x + 18, 319);
  });
  ctx.fillStyle = '#1f5fbf';
  ctx.font = '800 17px Arial, sans-serif';
  ctx.fillText('POZNÁMKY, NÁPADY A MATERIÁL', MARGIN_X, 397);
  ctx.fillStyle = '#10213d';
  ctx.font = '800 30px Arial, sans-serif';
  ctx.fillText('Podklady k projednání a realizaci', MARGIN_X, 435);
}

function drawItemChunk(ctx, item, index, bodyLines, y, continuation){
  const type = TYPE_LABELS[item.type] || TYPE_LABELS.note;
  const accent = TYPE_COLORS[item.type] || TYPE_COLORS.note;
  const accentBackground = TYPE_BACKGROUNDS[item.type] || TYPE_BACKGROUNDS.note;
  const titleFont = continuation ? '700 23px Arial, sans-serif' : '800 27px Arial, sans-serif';
  ctx.font = titleFont;
  const titleLines = wrapText(ctx, continuation ? `${item.title || 'Bez názvu'} – pokračování` : (item.title || 'Bez názvu'), CONTENT_WIDTH - 250);
  const headerHeight = continuation ? 86 + (titleLines.length * 30) : 118 + (titleLines.length * 33);
  const bodyLineHeight = 28;
  const bodyHeight = bodyLines.length ? (bodyLines.length * bodyLineHeight) + 16 : 0;
  const height = headerHeight + bodyHeight + 24;

  fillRoundRect(ctx, MARGIN_X, y, CONTENT_WIDTH, height, 18, '#ffffff');
  strokeRoundRect(ctx, MARGIN_X, y, CONTENT_WIDTH, height, 18, '#d7e0ec', 2);
  ctx.fillStyle = accent;
  ctx.fillRect(MARGIN_X, y + 18, 8, height - 36);

  fillRoundRect(ctx, MARGIN_X + 24, y + 22, 54, 42, 13, accent);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 20px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(index + 1), MARGIN_X + 51, y + 50);
  ctx.textAlign = 'left';

  const badgeWidth = Math.max(110, ctx.measureText(type.toUpperCase()).width + 30);
  fillRoundRect(ctx, MARGIN_X + 92, y + 22, badgeWidth, 42, 13, accentBackground);
  ctx.fillStyle = accent;
  ctx.font = '800 17px Arial, sans-serif';
  ctx.fillText(type.toUpperCase(), MARGIN_X + 107, y + 50);

  ctx.fillStyle = '#65738a';
  ctx.font = '600 18px Arial, sans-serif';
  ctx.textAlign = 'right';
  const meta = item.type === 'material' && asNumber(item.price) > 0
    ? `${formatDate(item.date)} · ${formatCurrency(item.price)}`
    : formatDate(item.date);
  ctx.fillText(meta, PAGE_WIDTH_PX - MARGIN_X - 24, y + 50);
  ctx.textAlign = 'left';

  ctx.fillStyle = '#10213d';
  ctx.font = titleFont;
  let titleY = y + 92;
  for(const line of titleLines){
    ctx.fillText(line, MARGIN_X + 24, titleY);
    titleY += continuation ? 30 : 33;
  }

  if(bodyLines.length){
    ctx.strokeStyle = '#e4eaf2';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(MARGIN_X + 24, y + headerHeight - 10);
    ctx.lineTo(PAGE_WIDTH_PX - MARGIN_X - 24, y + headerHeight - 10);
    ctx.stroke();
    let bodyY = y + headerHeight + 18;
    for(const line of bodyLines){
      ctx.font = line.kind === 'url' ? '500 18px Arial, sans-serif' : '500 20px Arial, sans-serif';
      ctx.fillStyle = line.kind === 'url' ? '#1f5fbf' : '#33435d';
      ctx.fillText(line.text || ' ', MARGIN_X + 24, bodyY);
      bodyY += bodyLineHeight;
    }
  }
  return height;
}

function prepareBodyLines(ctx, item){
  const result = [];
  ctx.font = '500 20px Arial, sans-serif';
  for(const line of wrapText(ctx, item.description || '', CONTENT_WIDTH - 48)) result.push({kind:'text', text:line});
  if(item.url){
    if(result.length) result.push({kind:'text', text:''});
    ctx.font = '500 18px Arial, sans-serif';
    for(const line of wrapText(ctx, item.url, CONTENT_WIDTH - 48)) result.push({kind:'url', text:line});
  }
  return result;
}

function fitBodyLineCount(ctx, item, lines, availableHeight, continuation){
  ctx.font = continuation ? '700 23px Arial, sans-serif' : '800 27px Arial, sans-serif';
  const titleLines = wrapText(ctx, continuation ? `${item.title || 'Bez názvu'} – pokračování` : (item.title || 'Bez názvu'), CONTENT_WIDTH - 250);
  const headerHeight = continuation ? 86 + (titleLines.length * 30) : 118 + (titleLines.length * 33);
  const baseHeight = headerHeight + 24;
  if(!lines.length) return {count:0, height:baseHeight};
  const capacity = Math.max(0, Math.floor((availableHeight - baseHeight - 16) / 28));
  const count = Math.min(lines.length, capacity);
  return {count, height:baseHeight + (count ? (count * 28) + 16 : 0)};
}

async function renderPages(items, {logoDataUrl = '', ownerName = 'Daniel Baláž', recipientName = 'Honza Marek', generatedAt = new Date()} = {}){
  const logo = await loadImage(logoDataUrl);
  const pages = [];
  let canvas;
  let ctx;
  let y;
  let pageNumber = 0;

  const newPage = first => {
    canvas = document.createElement('canvas');
    canvas.width = PAGE_WIDTH_PX;
    canvas.height = PAGE_HEIGHT_PX;
    ctx = canvas.getContext('2d', {alpha:false});
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, PAGE_WIDTH_PX, PAGE_HEIGHT_PX);
    pageNumber += 1;
    if(first){
      drawMainHeader(ctx, logo, ownerName, recipientName);
      drawSummary(ctx, items, generatedAt);
      y = 474;
    }else{
      drawCompactHeader(ctx, pageNumber, recipientName);
      y = 146;
    }
  };

  const savePage = () => {
    drawFooter(ctx, pageNumber);
    pages.push(canvasToJpegBytes(canvas));
  };

  newPage(true);
  if(!items.length){
    fillRoundRect(ctx, MARGIN_X, y, CONTENT_WIDTH, 150, 18, '#f7f9fc');
    strokeRoundRect(ctx, MARGIN_X, y, CONTENT_WIDTH, 150, 18, '#d7e0ec', 2);
    ctx.fillStyle = '#65738a';
    ctx.font = '600 25px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Zatím nejsou vložené žádné podklady.', PAGE_WIDTH_PX / 2, y + 84);
    ctx.textAlign = 'left';
  }

  items.forEach((item, index) => {
    let remaining = prepareBodyLines(ctx, item);
    let continuation = false;
    let rendered = false;
    while(!rendered || remaining.length){
      const available = CONTENT_BOTTOM - y;
      let fit = fitBodyLineCount(ctx, item, remaining, available, continuation);
      if((remaining.length && fit.count === 0) || (!remaining.length && fit.height > available)){
        savePage();
        newPage(false);
        fit = fitBodyLineCount(ctx, item, remaining, CONTENT_BOTTOM - y, continuation);
      }
      const chunk = remaining.slice(0, fit.count);
      const height = drawItemChunk(ctx, item, index, chunk, y, continuation);
      y += height + 18;
      remaining = remaining.slice(fit.count);
      continuation = true;
      rendered = true;
      if(remaining.length){
        savePage();
        newPage(false);
      }
    }
  });

  savePage();
  return pages;
}

export async function buildElectricityPdfBlob(items, options = {}){
  const normalized = [...(Array.isArray(items) ? items : [])]
    .map(item => ({
      type: TYPE_LABELS[item?.type] ? item.type : 'note',
      title: String(item?.title || '').trim(),
      description: String(item?.description || '').trim(),
      date: String(item?.date || '').slice(0,10),
      price: Math.max(0, asNumber(item?.price)),
      url: String(item?.url || '').trim()
    }))
    .sort((a,b) => String(a.date).localeCompare(String(b.date)) || a.title.localeCompare(b.title, 'cs'));
  const jpegPages = await renderPages(normalized, options);
  const pdfBytes = createImagePdf(jpegPages);
  return new Blob([pdfBytes], {type:'application/pdf'});
}
