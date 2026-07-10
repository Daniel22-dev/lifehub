import {
  APP_VERSION,
  KDF_ITERATIONS,
  MIN_KDF_ITERATIONS,
  MAX_KDF_ITERATIONS
} from '../config/constants.js';

const cryptoApi = () => globalThis.crypto;
const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

export function bytesToBase64(bytes){
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for(let i = 0; i < arr.length; i += 0x8000){
    bin += String.fromCharCode(...arr.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

export function base64ToBytes(value){
  const b64 = String(value || '');
  if(!b64 || b64.length % 4 !== 0 || !BASE64_RE.test(b64)){
    throw new Error('Šifrovaná data mají neplatný Base64 formát.');
  }
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

export const bytesToB64 = bytesToBase64;
export const b64ToBytes = base64ToBytes;

export function validateKdfIterations(value, fallback = KDF_ITERATIONS){
  const candidate = value === undefined || value === null || value === '' ? fallback : Number(value);
  if(!Number.isInteger(candidate) || candidate < MIN_KDF_ITERATIONS || candidate > MAX_KDF_ITERATIONS){
    throw new Error(`Neplatný počet iterací KDF. Povolený rozsah je ${MIN_KDF_ITERATIONS}–${MAX_KDF_ITERATIONS}.`);
  }
  return candidate;
}

function requireCrypto(){
  const api = cryptoApi();
  if(!api?.subtle) throw new Error('Web Crypto API není dostupné.');
  return api;
}

export async function deriveVaultKey(password, salt, iterations = KDF_ITERATIONS){
  const api = requireCrypto();
  const rounds = validateKdfIterations(iterations);
  const base = await api.subtle.importKey(
    'raw',
    new TextEncoder().encode(String(password ?? '')),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return api.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: rounds, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptJson(obj, key){
  const api = requireCrypto();
  const iv = api.getRandomValues(new Uint8Array(12));
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  const cipher = await api.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
  return { iv: bytesToBase64(iv), data: bytesToBase64(cipher) };
}

export async function decryptJson(envelope, key){
  const api = requireCrypto();
  if(!envelope || typeof envelope !== 'object') throw new Error('Šifrovaná obálka chybí nebo je poškozená.');
  const iv = base64ToBytes(envelope.crypto?.iv || envelope.iv);
  if(iv.byteLength !== 12) throw new Error('Šifrovaná obálka má neplatný inicializační vektor.');
  const cipher = base64ToBytes(envelope.data);
  const plain = await api.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return JSON.parse(new TextDecoder().decode(plain));
}

export const encryptObjectWithKey = encryptJson;
export const decryptObjectWithKey = decryptJson;

export async function encryptBlobForIdb(file, key, version = APP_VERSION){
  const api = requireCrypto();
  if(!key) throw new Error('Trezor není odemčený; soubor nelze zašifrovat.');
  const iv = api.getRandomValues(new Uint8Array(12));
  const buffer = await file.arrayBuffer();
  const cipher = await api.subtle.encrypt({ name: 'AES-GCM', iv }, key, buffer);

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
  const api = requireCrypto();
  if(!key) throw new Error('Trezor není odemčený.');
  if(record?.kind !== 'LifeHub encrypted blob' || record?.crypto?.alg !== 'AES-GCM' || !(record.data instanceof Blob)){
    throw new Error('Uložený soubor nemá podporovaný šifrovaný formát.');
  }
  const iv = base64ToBytes(record.crypto.iv);
  if(iv.byteLength !== 12) throw new Error('Uložený soubor má neplatný inicializační vektor.');
  const cipher = await record.data.arrayBuffer();
  const plain = await api.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);

  try{
    return new File([plain], record.name || 'soubor', {
      type: record.type || 'application/octet-stream',
      lastModified: record.lastModified || Date.now()
    });
  }catch(error){
    const blob = new Blob([plain], { type: record.type || 'application/octet-stream' });
    blob.name = record.name || 'soubor';
    blob.lastModified = record.lastModified || Date.now();
    return blob;
  }
}

export async function deriveBackupKey(passphrase, salt, iterations = KDF_ITERATIONS){
  return deriveVaultKey(passphrase, salt, iterations);
}

export async function encryptBackupObject(obj, passphrase, version = APP_VERSION){
  const api = requireCrypto();
  const iterations = KDF_ITERATIONS;
  const salt = api.getRandomValues(new Uint8Array(16));
  const iv = api.getRandomValues(new Uint8Array(12));
  const key = await deriveBackupKey(passphrase, salt, iterations);
  const payload = new TextEncoder().encode(JSON.stringify(obj));
  const cipher = await api.subtle.encrypt({ name: 'AES-GCM', iv }, key, payload);

  return {
    kind: 'LifeHub encrypted backup',
    version,
    createdAt: new Date().toISOString(),
    crypto: {
      alg: 'AES-GCM',
      kdf: 'PBKDF2-SHA256',
      iterations,
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv)
    },
    data: bytesToBase64(cipher)
  };
}

export async function decryptBackupObject(obj, passphrase){
  const api = requireCrypto();
  if(obj?.kind !== 'LifeHub encrypted backup') throw new Error('Soubor není šifrovaná LifeHub záloha.');
  if(obj?.crypto?.alg !== 'AES-GCM' || obj?.crypto?.kdf !== 'PBKDF2-SHA256') throw new Error('Záloha používá nepodporované šifrování.');
  const iterations = validateKdfIterations(obj.crypto?.iterations);
  const salt = base64ToBytes(obj.crypto?.salt);
  const iv = base64ToBytes(obj.crypto?.iv);
  if(salt.byteLength < 16 || iv.byteLength !== 12) throw new Error('Šifrovaná záloha má neplatné kryptografické parametry.');
  const key = await deriveBackupKey(passphrase, salt, iterations);
  const plain = await api.subtle.decrypt({ name: 'AES-GCM', iv }, key, base64ToBytes(obj.data));
  return JSON.parse(new TextDecoder().decode(plain));
}
