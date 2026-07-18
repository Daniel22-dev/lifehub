import {
  MAX_BACKUP_JSON_BYTES,
  MAX_COMPLETE_BACKUP_FILE_BYTES,
  MAX_COMPLETE_BACKUP_FILES,
  MAX_COMPLETE_BACKUP_TOTAL_BYTES,
  PDF_STORE,
  VAULT_STORE
} from '../config/constants.js';
import { estimateBase64Bytes } from './backup.js';

const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

export function assertBackupFileSize(file){
  if(!file) throw new Error('Nebyl vybrán žádný soubor.');
  if(Number(file.size) > MAX_BACKUP_JSON_BYTES){
    throw new Error(`Soubor zálohy je příliš velký (${formatBytes(file.size)}). Bezpečnostní limit je ${formatBytes(MAX_BACKUP_JSON_BYTES)}.`);
  }
}

export function validateBase64Payload(value, label = 'soubor'){
  const text = String(value || '');
  if(!text || text.length % 4 !== 0 || !BASE64_RE.test(text)){
    throw new Error(`${label} neobsahuje platná Base64 data.`);
  }
  return estimateBase64Bytes(text);
}

export function validateBackupFileRecord(record){
  if(!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('Neplatný záznam souboru v záloze.');
  const store = record.store === VAULT_STORE ? VAULT_STORE : (record.store === PDF_STORE ? PDF_STORE : '');
  if(!store) throw new Error('Záznam souboru používá neznámé úložiště.');
  const id = String(record.id || '');
  if(!/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw new Error('Záznam souboru má neplatný identifikátor.');
  const actualBytes = validateBase64Payload(record.data, record.name || id);
  const declaredBytes = Number(record.size);
  if(actualBytes <= 0 || actualBytes > MAX_COMPLETE_BACKUP_FILE_BYTES){
    throw new Error(`Soubor ${record.name || id} překračuje limit ${formatBytes(MAX_COMPLETE_BACKUP_FILE_BYTES)}.`);
  }
  if(Number.isFinite(declaredBytes) && declaredBytes > 0 && Math.abs(declaredBytes - actualBytes) > 2){
    throw new Error(`Soubor ${record.name || id} má nekonzistentní údaj o velikosti.`);
  }
  return {...record, id, store, size:actualBytes};
}

export function validateBackupFileSet(files, importedState){
  const list = Array.isArray(files) ? files : [];
  if(list.length > MAX_COMPLETE_BACKUP_FILES) throw new Error(`Kompletní záloha obsahuje příliš mnoho souborů (${list.length}).`);
  const expectedPayrolls = new Set((importedState?.payrolls || []).filter(item => item.storedPdf).map(item => item.id));
  const expectedDocs = new Set((importedState?.documents || []).filter(item => item.storedFile !== false).map(item => item.id));
  const expectedProjectFiles = new Set((importedState?.projects || []).flatMap(project => (project?.attachments || []).filter(item => item?.storedFile !== false).map(item => item.id)));
  const expectedVaultFiles = new Set([...expectedDocs, ...expectedProjectFiles]);
  const seen = new Set();
  const validated = [];
  let totalBytes = 0;

  for(const raw of list){
    const record = validateBackupFileRecord(raw);
    const composite = `${record.store}:${record.id}`;
    if(seen.has(composite)) throw new Error(`Záloha obsahuje duplicitní soubor ${record.name || record.id}.`);
    seen.add(composite);
    if(record.store === PDF_STORE && !expectedPayrolls.has(record.id)) throw new Error(`PDF ${record.name || record.id} nemá odpovídající záznam výplatní pásky.`);
    if(record.store === VAULT_STORE && !expectedVaultFiles.has(record.id)) throw new Error(`Dokument nebo projektová příloha ${record.name || record.id} nemá odpovídající metadata.`);
    totalBytes += record.size;
    if(totalBytes > MAX_COMPLETE_BACKUP_TOTAL_BYTES){
      throw new Error(`Kompletní záloha překračuje limit ${formatBytes(MAX_COMPLETE_BACKUP_TOTAL_BYTES)}.`);
    }
    validated.push(record);
  }

  const missingPayrolls = [...expectedPayrolls].filter(id => !seen.has(`${PDF_STORE}:${id}`));
  const missingDocs = [...expectedDocs].filter(id => !seen.has(`${VAULT_STORE}:${id}`));
  const missingProjectFiles = [...expectedProjectFiles].filter(id => !seen.has(`${VAULT_STORE}:${id}`));
  if(missingPayrolls.length || missingDocs.length || missingProjectFiles.length){
    throw new Error(`Kompletní záloha je neúplná: chybí ${missingPayrolls.length + missingDocs.length + missingProjectFiles.length} očekávaných souborů.`);
  }
  return {records:validated, totalBytes};
}

function formatBytes(bytes){
  const n = Number(bytes) || 0;
  if(n < 1024) return `${n} B`;
  if(n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
