import { b64ToBytes, bytesToB64 } from './crypto.js';

export const BIOMETRIC_RECORD_KIND = 'LifeHub biometric unlock';
export const BIOMETRIC_RECORD_VERSION = 1;
const WRAP_CONTEXT = new TextEncoder().encode('LifeHub biometric vault key v1');

function requireWebAuthn(){
  if(!globalThis.isSecureContext) throw new Error('Biometrické odemčení vyžaduje zabezpečené HTTPS připojení.');
  if(!globalThis.PublicKeyCredential || !globalThis.navigator?.credentials){
    throw new Error('Tento prohlížeč nepodporuje bezpečné odemykání zařízení.');
  }
}

function randomBytes(length = 32){
  const output = new Uint8Array(length);
  globalThis.crypto.getRandomValues(output);
  return output;
}

function recordIsValid(record){
  return record?.kind === BIOMETRIC_RECORD_KIND &&
    Number(record?.version) === BIOMETRIC_RECORD_VERSION &&
    typeof record?.credentialId === 'string' &&
    typeof record?.prfSalt === 'string' &&
    typeof record?.wrappedKey?.iv === 'string' &&
    typeof record?.wrappedKey?.data === 'string';
}

export function sanitizeBiometricRecord(record){
  if(!recordIsValid(record)) return null;
  try{
    const credentialId = b64ToBytes(record.credentialId);
    const prfSalt = b64ToBytes(record.prfSalt);
    const iv = b64ToBytes(record.wrappedKey.iv);
    const data = b64ToBytes(record.wrappedKey.data);
    if(!credentialId.byteLength || prfSalt.byteLength !== 32 || iv.byteLength !== 12 || data.byteLength < 32) return null;
    return {
      kind:BIOMETRIC_RECORD_KIND,
      version:BIOMETRIC_RECORD_VERSION,
      credentialId:bytesToB64(credentialId),
      prfSalt:bytesToB64(prfSalt),
      wrappedKey:{alg:'AES-GCM',iv:bytesToB64(iv),data:bytesToB64(data)},
      createdAt:String(record.createdAt || ''),
      rpId:String(record.rpId || '')
    };
  }catch(error){
    return null;
  }
}

export async function isPlatformBiometricAvailable(){
  try{
    requireWebAuthn();
    if(typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  }catch(error){
    return false;
  }
}

async function importWrappingKey(secret){
  const bytes = secret instanceof ArrayBuffer ? new Uint8Array(secret) : new Uint8Array(secret?.buffer || secret || []);
  if(bytes.byteLength !== 32) throw new Error('Zařízení neposkytlo platný biometrický klíč.');
  return globalThis.crypto.subtle.importKey('raw', bytes, {name:'AES-GCM'}, false, ['encrypt','decrypt']);
}

export async function wrapVaultKey(vaultKey, secret){
  const rawVaultKey = new Uint8Array(await globalThis.crypto.subtle.exportKey('raw', vaultKey));
  const wrappingKey = await importWrappingKey(secret);
  const iv = randomBytes(12);
  const encrypted = await globalThis.crypto.subtle.encrypt(
    {name:'AES-GCM',iv,additionalData:WRAP_CONTEXT},
    wrappingKey,
    rawVaultKey
  );
  rawVaultKey.fill(0);
  return {alg:'AES-GCM',iv:bytesToB64(iv),data:bytesToB64(new Uint8Array(encrypted))};
}

export async function unwrapVaultKey(wrappedKey, secret){
  if(wrappedKey?.alg !== 'AES-GCM') throw new Error('Biometrický záznam používá nepodporované šifrování.');
  const wrappingKey = await importWrappingKey(secret);
  const iv = b64ToBytes(wrappedKey.iv);
  const data = b64ToBytes(wrappedKey.data);
  const raw = await globalThis.crypto.subtle.decrypt(
    {name:'AES-GCM',iv,additionalData:WRAP_CONTEXT},
    wrappingKey,
    data
  );
  return globalThis.crypto.subtle.importKey('raw', raw, {name:'AES-GCM',length:256}, true, ['encrypt','decrypt']);
}

async function requestPrfSecret(credentialId, prfSalt){
  requireWebAuthn();
  const assertion = await navigator.credentials.get({
    publicKey:{
      challenge:randomBytes(32),
      timeout:60000,
      allowCredentials:[{type:'public-key',id:credentialId}],
      userVerification:'required',
      extensions:{prf:{eval:{first:prfSalt}}}
    }
  });
  const result = assertion?.getClientExtensionResults?.()?.prf?.results?.first;
  if(!result) throw new Error('Toto zařízení sice podporuje odemknutí, ale neposkytlo klíč PRF potřebný pro bezpečné rozšifrování trezoru.');
  return result;
}

export async function createBiometricRecord(vaultKey, {rpName='LifeHub',displayName='LifeHub – místní trezor'} = {}){
  requireWebAuthn();
  if(!await isPlatformBiometricAvailable()) throw new Error('Na tomto zařízení není dostupný otisk prstu, rozpoznání obličeje ani zámek zařízení pro webové aplikace.');
  const prfSalt = randomBytes(32);
  const credential = await navigator.credentials.create({
    publicKey:{
      challenge:randomBytes(32),
      rp:{name:rpName},
      user:{
        id:randomBytes(32),
        name:`lifehub-local-${Date.now()}`,
        displayName
      },
      pubKeyCredParams:[
        {type:'public-key',alg:-7},
        {type:'public-key',alg:-257}
      ],
      timeout:60000,
      attestation:'none',
      authenticatorSelection:{
        authenticatorAttachment:'platform',
        residentKey:'required',
        requireResidentKey:true,
        userVerification:'required'
      },
      extensions:{prf:{eval:{first:prfSalt}}}
    }
  });
  if(!credential?.rawId) throw new Error('Zařízení nevytvořilo přihlašovací klíč.');
  const prfOutput = credential.getClientExtensionResults?.()?.prf;
  if(prfOutput?.enabled !== true) throw new Error('Správce hesel nebo zámek telefonu nepodporuje bezpečné biometrické rozšifrování PRF.');
  const secret = prfOutput?.results?.first || await requestPrfSecret(credential.rawId, prfSalt);
  const wrappedKey = await wrapVaultKey(vaultKey, secret);
  return {
    kind:BIOMETRIC_RECORD_KIND,
    version:BIOMETRIC_RECORD_VERSION,
    credentialId:bytesToB64(new Uint8Array(credential.rawId)),
    prfSalt:bytesToB64(prfSalt),
    wrappedKey,
    createdAt:new Date().toISOString(),
    rpId:globalThis.location?.hostname || ''
  };
}

export async function unlockVaultKeyWithBiometrics(record){
  const safeRecord = sanitizeBiometricRecord(record);
  if(!safeRecord) throw new Error('Biometrický záznam je poškozený nebo neúplný.');
  requireWebAuthn();
  if(safeRecord.rpId && globalThis.location?.hostname && safeRecord.rpId !== globalThis.location.hostname){
    throw new Error('Biometrické odemčení bylo vytvořeno na jiné webové adrese. Použijte heslo a nastavte ho znovu.');
  }
  const secret = await requestPrfSecret(b64ToBytes(safeRecord.credentialId), b64ToBytes(safeRecord.prfSalt));
  return unwrapVaultKey(safeRecord.wrappedKey, secret);
}
