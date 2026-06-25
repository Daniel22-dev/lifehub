import { APP_VERSION, KDF_ITERATIONS } from '../config/constants.js';

export function bytesToBase64(bytes){
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for(let i = 0; i < arr.length; i += 0x8000){
    bin += String.fromCharCode(...arr.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

export function base64ToBytes(b64){
  const bin = atob(String(b64 || ''));
  const arr = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

export const bytesToB64 = bytesToBase64;
export const b64ToBytes = base64ToBytes;

export async function deriveVaultKey(password, salt, iterations = KDF_ITERATIONS){
  const rounds = Number.isFinite(Number(iterations)) && Number(iterations) > 0
    ? Number(iterations)
    : KDF_ITERATIONS;

  const base = await window.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: rounds, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptJson(obj, key){
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  const cipher = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
  return { iv: bytesToBase64(iv), data: bytesToBase64(cipher) };
}

export async function decryptJson(envelope, key){
  const iv = base64ToBytes(envelope.crypto?.iv || envelope.iv);
  const cipher = base64ToBytes(envelope.data);
  const plain = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return JSON.parse(new TextDecoder().decode(plain));
}

export const encryptObjectWithKey = encryptJson;
export const decryptObjectWithKey = decryptJson;

export async function encryptBlobForIdb(file, key, version = APP_VERSION){
  if(!key) throw new Error('Trezor není odemčený; soubor nelze zašifrovat.');
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const buffer = await file.arrayBuffer();
  const cipher = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, buffer);

  return {
    kind: 'LifeHub encrypted blob',
    version,
    name: file.name || '',
    type: file.type || 'application/octet-stream',
    size: file.size || buffer.byteLength,
    lastModified: file.lastModified || Date.now(),
    crypto: { alg: 'AES-GCM', iv: bytesToBase64(iv) },
    data: new Blob([cipher], { type: 'application/octet-stream' })
  };
}

export async function decryptBlobFromIdb(record, key){
  if(!key) throw new Error('Trezor není odemčený.');
  const cipher = await record.data.arrayBuffer();
  const plain = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(record.crypto?.iv) },
    key,
    cipher
  );

  try{
    return new File([plain], record.name || 'soubor', {
      type: record.type || 'application/octet-stream',
      lastModified: record.lastModified || Date.now()
    });
  }catch(e){
    const blob = new Blob([plain], { type: record.type || 'application/octet-stream' });
    blob.name = record.name || 'soubor';
    return blob;
  }
}

export async function deriveBackupKey(passphrase, salt, iterations = KDF_ITERATIONS){
  const rounds = Number.isFinite(Number(iterations)) && Number(iterations) > 0
    ? Number(iterations)
    : KDF_ITERATIONS;

  const enc = new TextEncoder();
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: rounds, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptBackupObject(obj, passphrase, version = APP_VERSION){
  if(!window.crypto?.subtle) throw new Error('Web Crypto API není dostupné.');
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveBackupKey(passphrase, salt, Number(obj.crypto?.iterations) || KDF_ITERATIONS);
  const payload = new TextEncoder().encode(JSON.stringify(obj));
  const cipher = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, payload);

  return {
    kind: 'LifeHub encrypted backup',
    version,
    createdAt: new Date().toISOString(),
    crypto: {
      alg: 'AES-GCM',
      kdf: 'PBKDF2-SHA256',
      iterations: KDF_ITERATIONS,
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv)
    },
    data: bytesToBase64(cipher)
  };
}

export async function decryptBackupObject(obj, passphrase){
  if(obj?.kind !== 'LifeHub encrypted backup') throw new Error('Soubor není šifrovaná LifeHub záloha.');
  const salt = base64ToBytes(obj.crypto?.salt);
  const iv = base64ToBytes(obj.crypto?.iv);
  const key = await deriveBackupKey(passphrase, salt, Number(obj.crypto?.iterations) || KDF_ITERATIONS);
  const plain = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, base64ToBytes(obj.data));
  return JSON.parse(new TextDecoder().decode(plain));
}
