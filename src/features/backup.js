import { MAX_COMPLETE_BACKUP_FILE_BYTES } from '../config/constants.js';
import { b64ToBytes, bytesToB64 } from '../security/crypto.js';

const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

export async function fileToBackupRecord({ id, store, role = 'file' }, file){
  if(!file) throw new Error('Chybí soubor pro zálohu.');
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if(bytes.byteLength > MAX_COMPLETE_BACKUP_FILE_BYTES){
    throw new Error(`Soubor ${file.name || id} je příliš velký pro kompletní zálohu.`);
  }
  return {
    id,
    store,
    role,
    name: file.name || '',
    type: file.type || 'application/octet-stream',
    size: bytes.byteLength,
    lastModified: file.lastModified || Date.now(),
    data: bytesToB64(bytes)
  };
}

export function backupRecordToFile(record){
  if(!record || typeof record !== 'object') throw new Error('Neplatný záznam souboru v záloze.');
  const data = String(record.data || '');
  if(!data || data.length % 4 !== 0 || !BASE64_RE.test(data)) throw new Error('Záznam souboru neobsahuje platná Base64 data.');
  const estimated = estimateBase64Bytes(data);
  if(estimated <= 0 || estimated > MAX_COMPLETE_BACKUP_FILE_BYTES) throw new Error('Soubor v záloze překračuje bezpečnostní limit velikosti.');
  const bytes = b64ToBytes(data);
  const name = String(record.name || record.id || 'soubor').slice(0, 220);
  const type = String(record.type || 'application/octet-stream').slice(0, 120);
  const lastModified = Number(record.lastModified) || Date.now();
  try{
    return new File([bytes], name, { type, lastModified });
  }catch(error){
    const blob = new Blob([bytes], { type });
    blob.name = name;
    blob.lastModified = lastModified;
    return blob;
  }
}

export function estimateBase64Bytes(value){
  const text = String(value || '');
  if(!text) return 0;
  const padding = text.endsWith('==') ? 2 : (text.endsWith('=') ? 1 : 0);
  return Math.max(0, Math.floor(text.length * 3 / 4) - padding);
}
