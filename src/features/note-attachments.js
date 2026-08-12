const PDF_MIME = 'application/pdf';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const HTML_MIMES = new Set(['text/html','application/xhtml+xml']);

export const NOTE_ATTACHMENT_ACCEPT = '.pdf,.docx,.html,.htm,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/html';

export function noteAttachmentKind(file){
  const name=String(file?.name||file?.fileName||'').trim().toLowerCase();
  const type=String(file?.type||file?.mime||'').trim().toLowerCase();
  if(type===PDF_MIME||name.endsWith('.pdf')) return 'pdf';
  if(type===DOCX_MIME||name.endsWith('.docx')) return 'docx';
  if(HTML_MIMES.has(type)||name.endsWith('.html')||name.endsWith('.htm')) return 'html';
  return '';
}

export function noteAttachmentIcon(kind){
  return {pdf:'📄',docx:'📝',html:'🧩'}[kind]||'📎';
}

export function noteAttachmentMetadata(notes){
  return (Array.isArray(notes)?notes:[]).flatMap(note=>(Array.isArray(note?.attachments)?note.attachments:[]).map(file=>({
    ...file,
    noteId:String(note?.id||''),
    noteTitle:String(note?.title||'Poznámka')
  })));
}
