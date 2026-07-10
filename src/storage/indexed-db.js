import { PDF_DB, PDF_STORE, VAULT_STORE, META_STORE } from '../config/constants.js';

const DB_VERSION = 4;

export function openDb(){
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PDF_DB, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if(!db.objectStoreNames.contains(PDF_STORE)) db.createObjectStore(PDF_STORE);
      if(!db.objectStoreNames.contains(VAULT_STORE)) db.createObjectStore(VAULT_STORE);
      if(!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE);
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onblocked = () => reject(new Error('Aktualizaci lokální databáze blokuje jiná otevřená karta LifeHubu. Zavřete ji a zkuste to znovu.'));
    request.onerror = () => reject(request.error || new Error('IndexedDB se nepodařilo otevřít.'));
  });
}

function requestResult(request){
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Operace IndexedDB selhala.'));
  });
}

function txDone(tx){
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Transakce IndexedDB selhala.'));
    tx.onabort = () => reject(tx.error || new Error('Transakce byla přerušena.'));
  });
}

export async function idbRawPut(id, value, store = PDF_STORE){
  const db = await openDb();
  try{
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value, id);
    await txDone(tx);
  }finally{
    db.close();
  }
}

export async function idbRawGet(id, store = PDF_STORE){
  const db = await openDb();
  try{
    const tx = db.transaction(store, 'readonly');
    return await requestResult(tx.objectStore(store).get(id));
  }finally{
    db.close();
  }
}

export async function idbGetKeys(store = PDF_STORE){
  const db = await openDb();
  try{
    const tx = db.transaction(store, 'readonly');
    return await requestResult(tx.objectStore(store).getAllKeys());
  }finally{
    db.close();
  }
}

export async function idbGetAllEntries(store = PDF_STORE){
  const db = await openDb();
  try{
    const tx = db.transaction(store, 'readonly');
    const objectStore = tx.objectStore(store);
    const [keys, values] = await Promise.all([
      requestResult(objectStore.getAllKeys()),
      requestResult(objectStore.getAll())
    ]);
    return keys.map((key, index) => [key, values[index]]);
  }finally{
    db.close();
  }
}

export async function idbDelete(id, store = PDF_STORE){
  const db = await openDb();
  try{
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(id);
    await txDone(tx);
  }finally{
    db.close();
  }
}

export async function idbClear(store){
  const db = await openDb();
  try{
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).clear();
    await txDone(tx);
  }finally{
    db.close();
  }
}

export async function idbGetMeta(key){
  return idbRawGet(key, META_STORE);
}

export async function idbPutMeta(key, value){
  return idbRawPut(key, value, META_STORE);
}

export async function idbDeleteMeta(key){
  return idbDelete(key, META_STORE);
}

export async function idbReplaceEncryptedStores({ payrollEntries = [], vaultEntries = [], rotationMarker = undefined, restoreMarker = undefined } = {}){
  const db = await openDb();
  try{
    const stores = [PDF_STORE, VAULT_STORE, META_STORE];
    const tx = db.transaction(stores, 'readwrite');
    const payrollStore = tx.objectStore(PDF_STORE);
    const vaultStore = tx.objectStore(VAULT_STORE);
    const metaStore = tx.objectStore(META_STORE);
    payrollStore.clear();
    vaultStore.clear();
    for(const [id, value] of payrollEntries) payrollStore.put(value, id);
    for(const [id, value] of vaultEntries) vaultStore.put(value, id);
    if(rotationMarker === null) metaStore.delete('keyRotation');
    else if(rotationMarker !== undefined) metaStore.put(rotationMarker, 'keyRotation');
    if(restoreMarker === null) metaStore.delete('restoreImport');
    else if(restoreMarker !== undefined) metaStore.put(restoreMarker, 'restoreImport');
    await txDone(tx);
  }finally{
    db.close();
  }
}
