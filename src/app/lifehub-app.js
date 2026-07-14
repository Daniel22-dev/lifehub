import {
  APP_VERSION,
  PUBLIC_BASE_URL,
  KDF_ITERATIONS,
  MIN_PASSWORD_LENGTH,
  MAX_PDF_SIZE_BYTES,
  MAX_PDF_PAGES,
  LEGACY_STORE,
  ENC_STORE,
  AUTO_LOCK_MINUTES,
  SAVE_DEBOUNCE_MS,
  PDF_STORE,
  VAULT_STORE,
  MAX_COMPLETE_BACKUP_FILES,
  MAX_COMPLETE_BACKUP_FILE_BYTES,
  MAX_COMPLETE_BACKUP_TOTAL_BYTES,
  MOBILE_COMPLETE_BACKUP_TOTAL_BYTES,
  MOBILE_BACKUP_JSON_BYTES
} from '../config/constants.js';
import { registerServiceWorker } from '../pwa/register-sw.js';
import { SCHOOL_LOGO_DATA_URI } from '../assets/school-logo-data.js';
import {
  $,
  $$,
  attr,
  currentYear,
  esc,
  monthNow,
  number,
  pad,
  safeCsvCell,
  safeId,
  safeUrl,
  sanitizeCurrency,
  strip,
  today,
  uid
} from '../core/utils.js';
import { choiceDialog, closeAllModals, confirmDialog, modalDialog, download, passwordDialog, toast } from '../core/ui.js';
import { SaveLifecycle } from '../core/save-lifecycle.js';
import { ensureUniqueIds, migrateStateSchema } from '../core/state-integrity.js';
import {
  b64ToBytes,
  bytesToB64,
  decryptBackupObject,
  decryptBlobFromIdb as cryptoDecryptBlobFromIdb,
  decryptObjectWithKey,
  deriveVaultKey,
  encryptBackupObject,
  encryptBlobForIdb as cryptoEncryptBlobForIdb,
  encryptObjectWithKey,
  validateKdfIterations
} from '../security/crypto.js';
import {
  createBiometricRecord,
  isPlatformBiometricAvailable,
  sanitizeBiometricRecord,
  unlockVaultKeyWithBiometrics
} from '../security/biometric.js';
import { backupRecordToFile, fileToBackupRecord } from '../features/backup.js';
import { assertBackupFileSize, validateBackupFileSet } from '../features/backup-validation.js';
import { buildTransactionRecord, summarizeMonthlyFinancialPlan } from '../features/finance.js';
import { isElanorPayslip, parseElanorPayslip } from '../features/payroll-elanor.js';
import {
  DEFAULT_FOOD_BUDGET,
  DEFAULT_FUEL_BUDGET,
  budgetMonthSummary,
  budgetYearData,
  currentRewardPeriod,
  normalizeRewardPeriod,
  minutesLabel,
  parseGroceryEntries,
  parseGroceryLines,
  rewardPeriodLabel,
  sumMinutes,
  sumRewardHours
} from '../features/budget.js';
import { calculateRegularInstallmentPayment } from '../features/installments.js';
import { buildFamilySnapshot, FAMILY_COLLECTIONS, FAMILY_EXCLUDED_DESCRIPTION, summarizeFamilySnapshot } from '../features/family-snapshot.js';
import { advanceAutomaticPayment, nextPaymentDueDate } from '../features/recurring-payments.js';
import {
  idbClear,
  idbDelete,
  idbDeleteMeta,
  idbGetAllEntries,
  idbGetKeys,
  idbGetMeta,
  idbRawGet,
  idbRawPut,
  idbPutMeta,
  idbReplaceEncryptedStores,
  openDb
} from '../storage/indexed-db.js';

export function bootLifeHub(){
    'use strict';

    const VERSION = APP_VERSION;
    const SHORT_VERSION = String(VERSION).split('-')[0]; // např. "3.1.8" – nadpis, titulek, zámek
    const FORBIDDEN_IMPORT_KEYS = new Set(['__proto__','constructor','prototype']);
    const STATE_SCHEMA_VERSION = 8;
    const BIOMETRIC_META_KEY = 'biometricUnlock';
    const VENDOR_BASE_URL = new URL('vendor/', PUBLIC_BASE_URL);
    const PDF_JS_LOCAL = new URL('pdf.min.mjs', VENDOR_BASE_URL).href;
    const PDF_WORKER_LOCAL = new URL('pdf.worker.min.mjs', VENDOR_BASE_URL).href;
    let pdfJsSource = '';
    let pdfjsLibRef = null;
    const fmt = n => `${(Number(n)||0).toLocaleString('cs-CZ',{maximumFractionDigits:0})} ${sanitizeCurrency(state.settings.currency)}`;
    const fmt2 = n => `${(Number(n)||0).toLocaleString('cs-CZ',{maximumFractionDigits:2})} ${sanitizeCurrency(state.settings.currency)}`;
    const monthLabel = m => m ? new Date(`${m}-01T00:00:00`).toLocaleDateString('cs-CZ',{month:'long',year:'numeric'}) : 'bez měsíce';
    const defaultState = () => ({
      version: VERSION,
      schemaVersion: STATE_SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      settings:{theme:'dark', greetName:'Dane', familyDisplayName:'', deviceName:'', ownerName:'Vlastník aplikace: Daniel Baláž · Gymnázium, Ostrava-Hrabůvka', ownerFooter:'© 2026 Daniel Baláž. Všechna práva vyhrazena.', currency:'Kč', savingGoal:0, foodBudget:DEFAULT_FOOD_BUDGET, fuelBudget:DEFAULT_FUEL_BUDGET, familyMemberId:'', familyPassword:'', familySettingsUpdatedAt:'', privateNotifications:true, lastDataBackupAt:'', lastCompleteBackupAt:'', lastVerifiedBackupAt:'', lastRestoreAt:''},
      notes:[], transactions:[], payrolls:[], documents:[], tasks:[], shopping:[], apps:[], installments:[], householdPayments:[], budgetEntries:[], groceries:[], aiEntries:[], aiClosedMonths:[], rewards:[], gardenItems:[], gardenLogs:[], partner:null
    });
    let state = defaultState();
    let vaultKey = null;
    let vaultSalt = null;
    let vaultIterations = KDF_ITERATIONS;
    let appReady = false;
    let saveInFlight = Promise.resolve(true);
    let pendingSaveCount = 0;
    let queuedSaveJob = null;
    let saveLoopActive = false;
    let renderFrame = 0;
    let lockPendingAfterSave = false;
    let encryptedStateEnvelope = null;
    let encryptedStateSource = '';
    let startupStorageError = null;
    let pendingLegacyEnvelopeCleanup = false;
    let biometricUnlockRecord = null;
    let biometricPlatformAvailable = null;
    let biometricUnlockInProgress = false;
    let biometricGateAttempt = 0;
    let fullscreenMode = 'none';
    const saveLifecycle = new SaveLifecycle();
    let autoLockTimer = null;
    let lastActivityAt = Date.now();
    let selectedAppId = null;
    let currentPayroll = {file:null, text:'', parsed:{}, evidence:{}};
    const payFieldDefs = [
      ['cleanPay','Čistá mzda',['cista mzda','cisty prijem']],
      ['netPay','Na účet / dobírka',['dobirka','k vyplate','castka k vyplate','doplatek k vyplate','vyplaceno','na ucet']],
      ['grossPay','Hrubá mzda / hrubý příjem',['hruba mzda','hruby prijem','uhrn prijmu','zdanitelny prijem','hruba odmena']],
      ['taxBase','Základ daně',['zaklad dane','danovy zaklad','zakl. dane']],
      ['incomeTax','Daň / záloha na daň',['zaloha na dan','dan z prijmu','srazena dan','dan celkem']],
      ['taxpayerDiscount','Sleva na poplatníka',['sleva na poplatnika','zakladni sleva','sleva poplatnik']],
      ['childDiscount','Daňové zvýhodnění / bonus',['danove zvyhodneni','danovy bonus','zvyhodneni na dite','bonus na dite']],
      ['socialInsurance','Sociální pojištění zaměstnance',['socialni pojisteni','pojistne socialni','socialni zabezpeceni','soc. poj.']],
      ['healthInsurance','Zdravotní pojištění zaměstnance',['zdravotni pojisteni','pojistne zdravotni','zdrav. poj.']],
      ['deductions','Srážky celkem',['srazky celkem','srazky','exekuce','ostatni srazky']],
      ['mealVouchers','Stravenky / benefity',['stravenky','stravne','benefity','benefit']],
      ['bonus','Odměny / prémie',['odmena','odmeny','premie','bonus']],
      ['sickPay','Nemoc / náhrada mzdy',['nemocenska','nemoc','nahrada mzdy','docasna pracovni neschopnost']],
      ['vacationPay','Dovolená / náhrada dovolené',['dovolena','nahrada dovolene']],
      ['overtime','Přesčas / příplatek',['prescas','priplatek','priplatky','nocni','svatek']],
      ['workedHours','Odpracované hodiny/dny',['odpracovano','odpracovane hodiny','odpracovane dny','fond pracovni doby']],
      ['employerCost','Náklad zaměstnavatele',['superhruba','naklady zamestnavatele','cena prace']]
    ];

    function loadLegacyState(){
      try{
        const raw = localStorage.getItem(LEGACY_STORE);
        if(!raw) return defaultState();
        const parsed = JSON.parse(raw);
        return merge(defaultState(), parsed);
      }catch(e){ return defaultState(); }
    }
    function hasEncryptedState(){ return !!encryptedStateEnvelope; }
    function hasLegacyState(){
      try{ return !!localStorage.getItem(LEGACY_STORE); }catch(error){ console.warn('Kontrola staršího nešifrovaného stavu selhala.', error); return false; }
    }
    function isSupportedEncryptedStateEnvelope(value){
      return !!(value && typeof value === 'object' && value.kind === 'LifeHub encrypted local state' && value.crypto?.alg === 'AES-GCM' && value.crypto?.kdf === 'PBKDF2-SHA256' && value.crypto?.salt && value.crypto?.iv && value.data);
    }
    async function loadEncryptedStateEnvelope(){
      let idbEnvelope = null;
      let localEnvelope = null;
      let idbError = null;
      let localError = null;
      let invalidIdbEnvelope = false;
      startupStorageError = null;
      encryptedStateSource = '';
      pendingLegacyEnvelopeCleanup = false;

      try{
        idbEnvelope = await idbGetMeta('encryptedState');
      }catch(error){
        idbError = error;
        console.warn('Načtení šifrovaného stavu z IndexedDB selhalo.', error);
      }

      try{
        const raw = localStorage.getItem(ENC_STORE);
        if(raw) localEnvelope = JSON.parse(raw);
      }catch(error){
        localError = error;
        console.warn('Načtení staršího šifrovaného stavu z localStorage selhalo.', error);
      }

      if(isSupportedEncryptedStateEnvelope(idbEnvelope)){
        encryptedStateEnvelope = idbEnvelope;
        encryptedStateSource = 'indexeddb';
        if(isSupportedEncryptedStateEnvelope(localEnvelope)) pendingLegacyEnvelopeCleanup = true;
        return encryptedStateEnvelope;
      }

      if(idbEnvelope && !isSupportedEncryptedStateEnvelope(idbEnvelope)){
        invalidIdbEnvelope = true;
        console.warn('Záznam encryptedState v IndexedDB má nepodporovaný formát; zkouším bezpečnostní kopii v localStorage.');
      }

      if(isSupportedEncryptedStateEnvelope(localEnvelope)){
        encryptedStateEnvelope = localEnvelope;
        encryptedStateSource = 'localstorage';
        try{
          await idbPutMeta('encryptedState', localEnvelope);
          encryptedStateSource = 'localstorage-copied-to-indexeddb';
          pendingLegacyEnvelopeCleanup = true;
        }catch(error){
          console.warn('Bezpečnostní kopie trezoru zůstává v localStorage, protože zápis do IndexedDB selhal.', error);
        }
        return encryptedStateEnvelope;
      }

      encryptedStateEnvelope = null;
      if(invalidIdbEnvelope){
        startupStorageError = new Error('LifeHub našel lokální trezor v nepodporovaném nebo poškozeném formátu. Z bezpečnostních důvodů nenabídne založení nového trezoru.');
      }else if(idbError){
        startupStorageError = new Error('LifeHub nemohl přečíst lokální databázi. Z bezpečnostních důvodů nenabídne založení nového trezoru, dokud se úložiště znovu nenačte.');
        startupStorageError.cause = idbError;
      }else if(localError){
        startupStorageError = new Error('LifeHub nemohl zkontrolovat starší lokální trezor. Zkuste aplikaci úplně zavřít a znovu otevřít.');
        startupStorageError.cause = localError;
      }
      return null;
    }
    async function writeEncryptedStateEnvelope(envelope){
      await idbPutMeta('encryptedState', envelope);
      encryptedStateEnvelope = envelope;
      encryptedStateSource = 'indexeddb';
      if(pendingLegacyEnvelopeCleanup){
        try{
          localStorage.removeItem(ENC_STORE);
          pendingLegacyEnvelopeCleanup = false;
        }catch(error){ console.warn('Starší bezpečnostní kopii trezoru se nepodařilo odstranit.', error); }
      }
      return envelope;
    }
    async function deleteEncryptedStateEnvelope(){
      encryptedStateEnvelope = null;
      encryptedStateSource = '';
      pendingLegacyEnvelopeCleanup = false;
      await idbDeleteMeta('encryptedState').catch(()=>{});
      try{ localStorage.removeItem(ENC_STORE); }catch(error){ console.warn(error); }
    }
    function updateSaveUi(){
      const status = $('#saveStatus');
      const banner = $('#saveErrorBanner');
      const text = $('#saveErrorText');
      if(status){
        status.classList.toggle('save-status-failed', !!saveLifecycle.error);
        if(saveLifecycle.error) status.textContent = 'Uložení selhalo';
        else if(saveLifecycle.pending) status.textContent = 'Šifruji…';
        else if(saveLifecycle.dirty) status.textContent = 'Neuloženo';
        else if(appReady && saveLifecycle.lastSavedAt) status.textContent = 'Šifrováno ' + new Date(saveLifecycle.lastSavedAt).toLocaleTimeString('cs-CZ',{hour:'2-digit',minute:'2-digit'});
      }
      if(banner){
        banner.classList.toggle('active', !!saveLifecycle.error);
        if(text && saveLifecycle.error) text.textContent = saveLifecycle.error.message || String(saveLifecycle.error);
      }
    }
    function hideUnsavedGuard(){
      $('#unsavedGuard')?.classList.remove('active');
      document.body.classList.remove('guarded');
      if(appReady) setAppInert(false);
    }
    function showUnsavedGuard(message='Poslední změny se nepodařilo bezpečně uložit.'){
      closeAllModals();
      const guard = $('#unsavedGuard');
      const text = $('#unsavedGuardText');
      if(text) text.textContent = `${message} Obsah aplikace je skrytý, ale zůstává v paměti. Zkuste uložení zopakovat, stáhněte nouzovou šifrovanou zálohu, nebo změny výslovně zahoďte.`;
      guard?.classList.add('active');
      document.body.classList.add('guarded');
      setAppInert(true);
      setTimeout(()=>$('#guardRetrySaveBtn')?.focus(),0);
    }
    function scheduleRenderAll(){
      if(renderFrame) return;
      const schedule = globalThis.requestAnimationFrame || (callback => setTimeout(callback, 0));
      renderFrame = schedule(() => {
        renderFrame = 0;
        if(appReady) renderAll();
      });
    }
    function save(render=true){
      if(!appReady || !vaultKey){
        if(render && appReady) renderAll();
        return Promise.resolve(false);
      }
      state.updatedAt = new Date().toISOString();
      state.version = VERSION;
      state.schemaVersion = STATE_SCHEMA_VERSION;
      saveLifecycle.markDirty();
      queuedSaveJob = {
        key:vaultKey,
        salt:vaultSalt,
        iterations:vaultIterations,
        snapshot:JSON.parse(JSON.stringify(state))
      };
      pendingSaveCount = 1;
      updateSaveUi();
      if(!saveLoopActive){
        saveLoopActive = true;
        saveInFlight = runSaveQueue();
      }
      if(render) scheduleRenderAll();
      return saveInFlight;
    }
    async function runSaveQueue(){
      let ok = true;
      try{
        await new Promise(resolve => setTimeout(resolve, SAVE_DEBOUNCE_MS));
        while(queuedSaveJob){
          const job = queuedSaveJob;
          queuedSaveJob = null;
          saveLifecycle.begin();
          updateSaveUi();
          try{
            await persistEncryptedState(job.key, job.salt, job.snapshot, job.iterations);
          }catch(error){
            console.error(error);
            queuedSaveJob = null;
            saveLifecycle.fail(error);
            toast('Šifrované uložení se nepodařilo: '+(error.message||error), 'bad');
            ok = false;
            break;
          }
        }
        if(ok){
          saveLifecycle.succeed();
          hideUnsavedGuard();
        }
      }finally{
        pendingSaveCount = 0;
        saveLoopActive = false;
        updateSaveUi();
      }
      if(ok && lockPendingAfterSave){
        lockPendingAfterSave = false;
        setTimeout(()=>lockApp({force:true, reason:'after-save'}),0);
      }
      return ok;
    }
    async function retryFailedSave(){
      if(!appReady || !vaultKey) return false;
      const result = await save(false);
      if(result) toast('Neuložené změny byly bezpečně uloženy.','good');
      return result;
    }
    async function exportEmergencyEncryptedBackup(){
      if(!appReady || !vaultKey){ toast('Trezor není odemčený.','warn'); return false; }
      const pass = await passwordDialog({title:'Nouzová šifrovaná záloha',message:'Zadejte samostatné heslo. Záloha zachytí aktuální stav z paměti i tehdy, když se jej nepodařilo uložit do zařízení. Neobsahuje fyzické PDF a dokumenty.',repeat:true,minLength:MIN_PASSWORD_LENGTH,confirmText:'Stáhnout nouzovou zálohu'});
      if(!pass) return false;
      try{
        const createdAt = new Date().toISOString();
        const payload = {kind:'LifeHub data backup',version:VERSION,mode:'emergency-data-only',createdAt,metadata:backupMetadata('emergency-data-only',createdAt),note:'Nouzová šifrovaná záloha aktuálního stavu z paměti. Neobsahuje fyzické soubory z IndexedDB.',state:cloneStateForBackup()};
        const encrypted = await encryptBackupObject(payload, pass, VERSION);
        download(`lifehub-nouzova-zaloha-${today()}.json`,JSON.stringify(encrypted,null,2),'application/json;charset=utf-8');
        toast('Nouzová šifrovaná záloha byla stažena. Neuložený stav v aplikaci zůstává.','good');
        return true;
      }catch(error){ console.error(error); toast('Nouzovou zálohu se nepodařilo vytvořit: '+(error.message||error),'bad'); return false; }
    }
    async function discardUnsavedAndLock(){
      const ok = await confirmDialog('Opravdu zahodit změny, které se nepodařilo uložit, a aplikaci zamknout? Pokračujte jen tehdy, pokud už máte nouzovou zálohu nebo změny nepotřebujete.',{title:'Zahodit neuložené změny',confirmText:'Zahodit a zamknout',danger:true});
      if(!ok) return;
      queuedSaveJob = null;
      saveLifecycle.reset();
      lockPendingAfterSave = false;
      updateSaveUi();
      hideUnsavedGuard();
      await lockApp({force:true,reason:'discard'});
    }
    async function createEncryptedStateEnvelope(snapshot, key, salt, iterations){
      if(!key || !salt) throw new Error('Trezor není odemčený.');
      const rounds = validateKdfIterations(iterations);
      const encrypted = await encryptObjectWithKey(snapshot, key);
      return {kind:'LifeHub encrypted local state',version:VERSION,schemaVersion:STATE_SCHEMA_VERSION,updatedAt:new Date().toISOString(),crypto:{alg:'AES-GCM',kdf:'PBKDF2-SHA256',iterations:rounds,salt:bytesToB64(salt),iv:encrypted.iv},data:encrypted.data};
    }
    async function persistEncryptedState(key=vaultKey, salt=vaultSalt, snapshot=state, iterations=vaultIterations){
      const envelope = await createEncryptedStateEnvelope(snapshot, key, salt, iterations);
      await writeEncryptedStateEnvelope(envelope);
      try{ localStorage.removeItem(LEGACY_STORE); }catch(error){ console.warn(error); }
      return envelope;
    }
    function csv(rows){
      return rows.map(r=>r.map(v=>`"${safeCsvCell(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    }
    function mdEscape(s){return String(s??'').replace(/\r/g,'').trim();}
    function setTheme(theme){
      state.settings.theme = theme;
      document.documentElement.dataset.theme = theme;
      document.querySelector('meta[name="theme-color"]').setAttribute('content', theme==='dark'?'#11152f':'#f5f7ff');
      $('#themeBtn').textContent = theme==='dark' ? '☀︎' : '☾';
    }
    async function init(){
      setTheme(state.settings.theme || 'dark');
      $('#dashYear').value = currentYear();
      $('#financeYear').value = currentYear();
      $('#shoppingYear').value = currentYear();
      $('#vaultDate').value = today();
      $('#financeMonth').value = monthNow();
      $('#payMonth').value = monthNow();
      if($('#payPaidDate')) $('#payPaidDate').value = today();
      $('#transDate').value = today();
      $('#shopMonth').value = monthNow();
      if($('#instStart')) $('#instStart').value = monthNow();
      if($('#paymentDueDate')) $('#paymentDueDate').value = today();
      if($('#budgetMonth')) $('#budgetMonth').value = monthNow();
      if($('#budgetYear')) $('#budgetYear').value = currentYear();
      if($('#budgetDate')) $('#budgetDate').value = today();
      if($('#aiMonth')) $('#aiMonth').value = monthNow();
      if($('#aiDate')) $('#aiDate').value = today();
      if($('#gardenLogDate')) $('#gardenLogDate').value = today();
      populateRewardPeriodSelects();
      renderPayrollFieldInputs();
      bind();
      updateFab('dashboard');
      hydrateSettings();
      applyVersionLabels();
      renderFooter();
      await startSecureGate();
      registerSW();
    }
    function bind(){
      $$('.nav button').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));
      $$('.mobile-dock [data-tab]').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));
      $('#mobileMoreBtn')?.addEventListener('click',toggleMobileNav);
      $('#mobileNavBackdrop')?.addEventListener('click',closeMobileNav);
      document.addEventListener('click', handleActions);
      $('#themeBtn').addEventListener('click',()=>{setTheme(state.settings.theme==='dark'?'light':'dark'); save(false);});
      $('#manualBtn')?.addEventListener('click',()=>showTab('help'));
      $('#reloadManualBtn')?.addEventListener('click',()=>{ const frame=$('#manualFrame'); if(frame){ frame.src='./manual.html?refresh='+Date.now(); } });
      $('#lockBtn')?.addEventListener('click',()=>lockApp({reason:'manual'}));
      $('#retrySaveBtn')?.addEventListener('click',retryFailedSave);
      $('#guardRetrySaveBtn')?.addEventListener('click',retryFailedSave);
      $('#emergencyBackupBtn')?.addEventListener('click',exportEmergencyEncryptedBackup);
      $('#guardEmergencyBackupBtn')?.addEventListener('click',exportEmergencyEncryptedBackup);
      $('#discardAndLockBtn')?.addEventListener('click',discardUnsavedAndLock);
      $('#guardDiscardBtn')?.addEventListener('click',discardUnsavedAndLock);
      $('#lockForm')?.addEventListener('submit',handleUnlockSubmit);
      $('#biometricUnlockBtn')?.addEventListener('click',handleBiometricUnlock);
      $('#enableBiometricBtn')?.addEventListener('click',enableBiometricUnlock);
      $('#removeBiometricBtn')?.addEventListener('click',()=>removeBiometricUnlock());
      $('#wipeEncryptedBtn')?.addEventListener('click',wipeEncryptedVault);
      ['pointerdown','keydown','touchstart'].forEach(ev=>document.addEventListener(ev,markActivity,{passive:true}));
      document.addEventListener('visibilitychange',()=>{ if(!document.hidden && appReady) enforceAutoLock(); });
      window.addEventListener('beforeunload',event=>{ if(pendingSaveCount>0 || saveLifecycle.blocksSafeLock){ event.preventDefault(); event.returnValue=''; } });
      window.addEventListener('message',event=>{ if(event.origin===location.origin && event.data?.type==='lifehub-manual-activity') markActivity(); });
      document.addEventListener('keydown',trapLockFocus);
      document.addEventListener('keydown',event=>{
        if(event.key==='Escape') closeMobileNav();
        if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='f'&&appReady){
          event.preventDefault();
          showTab('dashboard');
          setTimeout(()=>$('#globalSearch')?.focus(),80);
        }
      });
      $('#fullscreenBtn').addEventListener('click',toggleFullscreen);
      document.addEventListener('fullscreenchange',handleFullscreenChange);
      document.addEventListener('webkitfullscreenchange',handleFullscreenChange);
      $('#noteForm').addEventListener('submit', saveNote);
      $('#resetNote').addEventListener('click', resetNoteForm);
      ['noteSearch','noteSourceFilter','noteTypeFilter','noteTagFilter','noteSort'].forEach(id=>$('#'+id).addEventListener('input',renderNotes));
      $('#globalSearch').addEventListener('input',renderGlobalSearch);
      $('#parsePayrollBtn').addEventListener('click',parsePayrollPdf);
      $('#importPayrollPdfBatchBtn')?.addEventListener('click',importPayrollPdfBatch);
      $('#payrollPdf').addEventListener('change',handlePayrollFileSelection);
      $('#clearPayrollBtn').addEventListener('click',clearPayrollImport);
      $('#savePayrollBtn').addEventListener('click',savePayrollRecord);
      $('#importPayrollsBtn')?.addEventListener('click',()=>$('#importPayrollsFile')?.click());
      $('#importPayrollsFile')?.addEventListener('change',importPayrollsJson);
      $('#financeMonth').addEventListener('input',renderFinance);
      $('#financeYear').addEventListener('input',renderFinance);
      $('#dashYear').addEventListener('input',renderDashboard);
      $('#transactionForm').addEventListener('submit',saveTransaction);
      $('#vaultForm').addEventListener('submit',saveVaultDoc);
      $('#resetVault').addEventListener('click',resetVaultForm);
      ['vaultSearch','vaultCategoryFilter','vaultSort'].forEach(id=>$('#'+id).addEventListener('input',renderVault));
      $('#resetTrans').addEventListener('click',resetTransactionForm);
      ['transSearch','transKindFilter','transSourceFilter','transPeriodFilter'].forEach(id=>$('#'+id).addEventListener('input',renderFinance));
      $('#taskForm').addEventListener('submit',saveTask);
      $('#resetTask').addEventListener('click',resetTaskForm);
      ['taskSearch','taskStatusFilter','taskAreaFilter','taskSort'].forEach(id=>$('#'+id).addEventListener('input',renderTasks));
      $('#shoppingForm').addEventListener('submit',saveShopping);
      $('#resetShop').addEventListener('click',resetShoppingForm);
      ['shopSearch','shopPriorityFilter','shopStatusFilter','shopSort','shoppingYear'].forEach(id=>$('#'+id).addEventListener('input',renderShopping));
      $('#appForm')?.addEventListener('submit',saveApp);
      $('#resetApp')?.addEventListener('click',resetAppForm);
      ['appSearch','appSort'].forEach(id=>$('#'+id)?.addEventListener('input',renderApps));
      $('#appBackBtn')?.addEventListener('click',()=>{ selectedAppId=null; renderApps(); });
      $('#appNoteForm')?.addEventListener('submit',saveAppNote);
      $('#instForm')?.addEventListener('submit',saveInstallment);
      $('#resetInst')?.addEventListener('click',resetInstallmentForm);
      $('#paymentForm')?.addEventListener('submit',saveHouseholdPayment);
      $('#resetPayment')?.addEventListener('click',resetHouseholdPaymentForm);
      $('#enableNotifBtn')?.addEventListener('click',enableInstallmentNotifications);
      $('#budgetForm')?.addEventListener('submit',saveBudgetEntry);
      $('#resetBudget')?.addEventListener('click',resetBudgetForm);
      $('#budgetLimitsForm')?.addEventListener('submit',saveBudgetLimits);
      ['budgetMonth','budgetYear'].forEach(id=>$('#'+id)?.addEventListener('input',renderBudget));
      $('#groceryQuickForm')?.addEventListener('submit',addGroceryQuick);
      $('#groceryBulkForm')?.addEventListener('submit',addGroceryBulk);
      $('#groceryBulkText')?.addEventListener('input',renderGroceryBulkPreview);
      $('#groceryBulkStore')?.addEventListener('input',renderGroceryBulkPreview);
      $('#clearGroceryBulk')?.addEventListener('click',()=>{ $('#groceryBulkText').value=''; renderGroceryBulkPreview(); $('#groceryBulkText').focus(); });
      $('#groceryPhotoInput')?.addEventListener('change',addGroceryPhoto);
      $('#clearBoughtBtn')?.addEventListener('click',clearBoughtGroceries);
      $('#aiForm')?.addEventListener('submit',saveAiEntry);
      $('#resetAi')?.addEventListener('click',resetAiForm);
      $('#aiMonth')?.addEventListener('input',renderAiLog);
      $('#aiCloseBtn')?.addEventListener('click',toggleAiMonthClosed);
      $('#aiPrintBtn')?.addEventListener('click',()=>printReport(buildAiReportHtml($('#aiMonth')?.value||monthNow())));
      $('#aiHtmlBtn')?.addEventListener('click',downloadAiReportHtml);
      $('#rewardForm')?.addEventListener('submit',saveReward);
      $('#resetReward')?.addEventListener('click',resetRewardForm);
      $('#gardenItemForm')?.addEventListener('submit',saveGardenItem);
      $('#resetGardenItem')?.addEventListener('click',resetGardenItemForm);
      $('#gardenLogForm')?.addEventListener('submit',saveGardenLog);
      $('#resetGardenLog')?.addEventListener('click',resetGardenLogForm);
      $('#gardenLogFilter')?.addEventListener('input',renderGarden);
      $('#partnerImportBtn')?.addEventListener('click',()=>$('#partnerImportFile')?.click());
      $('#partnerImportFile')?.addEventListener('change',importPartnerShare);
      $('#partnerDeleteBtn')?.addEventListener('click',deletePartnerData);
      $('#rewardPeriodSelect')?.addEventListener('input',renderRewards);
      $('#rewardPrintBtn')?.addEventListener('click',()=>printReport(buildRewardReportHtml(selectedRewardPeriod())));
      $('#rewardHtmlBtn')?.addEventListener('click',downloadRewardReportHtml);
      $('#fab')?.addEventListener('click',handleFabClick);
      document.addEventListener('click',handleInfoAndAddCards,true);
      $('#settingsForm').addEventListener('submit',saveSettings);
      $('#setFamilyPasswordBtn')?.addEventListener('click',setFamilyPassword);
      $('#removeFamilyPasswordBtn')?.addEventListener('click',removeFamilyPassword);
      $('#runDiagnostics').addEventListener('click',runDiagnostics);
      $('#changeVaultPassword')?.addEventListener('click',changeVaultPassword);
      $('#seedDemo').addEventListener('click',seedDemo);
      $('#clearAll').addEventListener('click',clearAllData);
      $('#requestPersist').addEventListener('click',requestPersistentStorage);
      $('#requestPersistSettings').addEventListener('click',requestPersistentStorage);
      $('#importJson').addEventListener('change',importJson);
      $('#verifyBackupFile')?.addEventListener('change',verifyBackupFile);
      $('#copyMarkdown').addEventListener('click',()=>navigator.clipboard?.writeText(buildMarkdown()).then(()=>toast('Markdown zkopírován.')).catch(()=>toast('Kopírování se nepovedlo.', 'bad')));
    }
    function closeMobileNav(){
      document.body.classList.remove('mobile-nav-open');
      $('#mobileMoreBtn')?.setAttribute('aria-expanded','false');
      $('#mobileNavBackdrop')?.setAttribute('aria-hidden','true');
    }
    function toggleMobileNav(){
      const open=!document.body.classList.contains('mobile-nav-open');
      document.body.classList.toggle('mobile-nav-open',open);
      $('#mobileMoreBtn')?.setAttribute('aria-expanded',String(open));
      $('#mobileNavBackdrop')?.setAttribute('aria-hidden',String(!open));
    }
    function syncMobileDock(id){
      const primaryTabs=new Set(['dashboard','tasks','finance','groceries']);
      $$('.mobile-dock [data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));
      $('#mobileMoreBtn')?.classList.toggle('active',!primaryTabs.has(id));
    }
    function showTab(id){
      $$('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));
      $$('.view').forEach(v=>v.classList.toggle('active',v.id===id));
      syncMobileDock(id);
      closeMobileNav();
      window.scrollTo({top:0,behavior:'smooth'});
      if(id==='exports') $('#markdownPreview').textContent = buildMarkdown();
      updateFab(id);
      renderAll();
    }
    async function handleActions(e){
      const jump = e.target.closest('[data-jump]')?.dataset.jump;
      if(jump){ e.preventDefault(); showTab(jump); return; }
      const action = e.target.closest('[data-action]')?.dataset.action;
      if(action){
        const map = {
          'export-json':exportJson,'export-encrypted-json':exportEncryptedJson,'export-complete-backup':exportCompleteEncryptedBackup,'transfer-wizard':showTransferWizard,'export-diagnostics':exportDiagnostics,'lock-app':lockApp,'export-all-md':async()=>{ if(await confirmPrivateExport('Soukromý Markdown')) download('lifehub-soukromy-export.md', buildMarkdown(),'text/markdown;charset=utf-8'); },
          'export-anon-md':()=>download('lifehub-anonymizovany-export.md', buildAnonymizedMarkdown(),'text/markdown;charset=utf-8'),
          'export-anon-json':()=>download('lifehub-anonymizovany-export.json', JSON.stringify(buildAnonymizedSnapshot(),null,2),'application/json;charset=utf-8'),
          'export-anon-payrolls-csv':()=>exportAnonymizedPayrollsCsv(),
          'export-vault-csv':()=>exportCsv('documents'),
          'export-notion-md':async()=>{ if(await confirmPrivateExport('Soukromý Notion Markdown')) download('lifehub-pro-notion.md', buildMarkdown(true),'text/markdown;charset=utf-8'); },
          'export-all-html':exportHtml,
          'export-notes-md':async()=>{ if(await confirmPrivateExport('Export poznámek Markdown')) download('lifehub-poznamky.md', notesMarkdown(),'text/markdown;charset=utf-8'); },
          'export-tasks-md':()=>download('lifehub-ukoly.md', tasksMarkdown(),'text/markdown;charset=utf-8'),
          'export-shopping-md':()=>download('lifehub-nakupy.md', shoppingMarkdown(),'text/markdown;charset=utf-8'),
          'export-notes-csv':()=>exportCsv('notes'), 'export-transactions-csv':()=>exportCsv('transactions'),
          'export-payrolls-csv':()=>exportCsv('payrolls'), 'export-tasks-csv':()=>exportCsv('tasks'), 'export-shopping-csv':()=>exportCsv('shopping'),
          'export-budget-csv':()=>exportCsv('budget'), 'export-groceries-csv':()=>exportCsv('groceries'),
          'export-ailog-csv':()=>exportCsv('ailog'), 'export-rewards-csv':()=>exportCsv('rewards'),
          'export-garden-csv':()=>exportCsv('garden'), 'export-gardenlog-csv':()=>exportCsv('gardenlog'),
          'export-payments-csv':()=>exportCsv('payments'),
          'export-partner-share':exportPartnerShare
        };
        await map[action]?.();
      }
      const editNote = e.target.closest('[data-edit-note]')?.dataset.editNote;
      const delNote = e.target.closest('[data-delete-note]')?.dataset.deleteNote;
      const editTrans = e.target.closest('[data-edit-trans]')?.dataset.editTrans;
      const delTrans = e.target.closest('[data-delete-trans]')?.dataset.deleteTrans;
      const delPayroll = e.target.closest('[data-delete-payroll]')?.dataset.deletePayroll;
      const downPayroll = e.target.closest('[data-download-payroll]')?.dataset.downloadPayroll;
      const purgePayroll = e.target.closest('[data-purge-payroll-pdf]')?.dataset.purgePayrollPdf;
      const delDoc = e.target.closest('[data-delete-doc]')?.dataset.deleteDoc;
      const downDoc = e.target.closest('[data-download-doc]')?.dataset.downloadDoc;
      const editTask = e.target.closest('[data-edit-task]')?.dataset.editTask;
      const delTask = e.target.closest('[data-delete-task]')?.dataset.deleteTask;
      const toggleTask = e.target.closest('[data-toggle-task]')?.dataset.toggleTask;
      const editShop = e.target.closest('[data-edit-shop]')?.dataset.editShop;
      const delShop = e.target.closest('[data-delete-shop]')?.dataset.deleteShop;
      const shopStatusButton = e.target.closest('[data-shop-status]');
      const viewNote = e.target.closest('[data-view-note]')?.dataset.viewNote;
      const openApp = e.target.closest('[data-open-app]')?.dataset.openApp;
      const editApp = e.target.closest('[data-edit-app]')?.dataset.editApp;
      const delApp = e.target.closest('[data-delete-app]')?.dataset.deleteApp;
      const delAppNote = e.target.closest('[data-del-app-note]')?.dataset.delAppNote;
      const editInst = e.target.closest('[data-edit-inst]')?.dataset.editInst;
      const delInst = e.target.closest('[data-delete-inst]')?.dataset.deleteInst;
      const payInst = e.target.closest('[data-pay-inst]')?.dataset.payInst;
      const extraInst = e.target.closest('[data-extra-inst]')?.dataset.extraInst;
      const reopenInst = e.target.closest('[data-reopen-inst]')?.dataset.reopenInst;
      const editPayment = e.target.closest('[data-edit-payment]')?.dataset.editPayment;
      const delPayment = e.target.closest('[data-delete-payment]')?.dataset.deletePayment;
      const payPayment = e.target.closest('[data-pay-payment]')?.dataset.payPayment;
      const editBudget = e.target.closest('[data-edit-budget]')?.dataset.editBudget;
      const delBudget = e.target.closest('[data-delete-budget]')?.dataset.deleteBudget;
      const toggleGrocery = e.target.closest('[data-toggle-grocery]')?.dataset.toggleGrocery;
      const delGrocery = e.target.closest('[data-delete-grocery]')?.dataset.deleteGrocery;
      const viewGPhoto = e.target.closest('[data-view-gphoto]')?.dataset.viewGphoto;
      const delGPhoto = e.target.closest('[data-delete-gphoto]')?.dataset.deleteGphoto;
      const editAi = e.target.closest('[data-edit-ai]')?.dataset.editAi;
      const delAi = e.target.closest('[data-delete-ai]')?.dataset.deleteAi;
      const editGItem = e.target.closest('[data-edit-gitem]')?.dataset.editGitem;
      const delGItem = e.target.closest('[data-delete-gitem]')?.dataset.deleteGitem;
      const toggleGItem = e.target.closest('[data-toggle-gitem]')?.dataset.toggleGitem;
      const editGLog = e.target.closest('[data-edit-glog]')?.dataset.editGlog;
      const delGLog = e.target.closest('[data-delete-glog]')?.dataset.deleteGlog;
      const editReward = e.target.closest('[data-edit-reward]')?.dataset.editReward;
      const delReward = e.target.closest('[data-delete-reward]')?.dataset.deleteReward;
      const showChlog = e.target.closest('[data-show-changelog]');
      if(editNote) editNoteForm(editNote); if(delNote) deleteItem('notes',delNote); if(viewNote) openNoteDetail(viewNote);
      if(editTrans) editTransactionForm(editTrans); if(delTrans) deleteTransaction(delTrans);
      if(delPayroll) deletePayroll(delPayroll); if(downPayroll) downloadPayrollPdf(downPayroll); if(purgePayroll) purgePayrollPdf(purgePayroll);
      if(delDoc) deleteVaultDoc(delDoc); if(downDoc) downloadVaultDoc(downDoc);
      if(editTask) editTaskForm(editTask); if(delTask) deleteItem('tasks',delTask); if(toggleTask) toggleTaskDone(toggleTask);
      if(editShop) editShoppingForm(editShop); if(delShop) deleteItem('shopping',delShop); if(shopStatusButton) setShoppingStatus(shopStatusButton.dataset.shopId,shopStatusButton.dataset.shopStatus);
      if(openApp) openApp1(openApp); if(editApp) editApp1(editApp); if(delApp) deleteApp(delApp); if(delAppNote) deleteAppNote(delAppNote);
      if(editInst) editInstallment(editInst); if(delInst) deleteInstallment(delInst); if(payInst) recordInstallmentPayment(payInst); if(extraInst) recordExtraPayment(extraInst); if(reopenInst) reopenInstallment(reopenInst);
      if(editPayment) editHouseholdPayment(editPayment); if(delPayment) deleteHouseholdPayment(delPayment); if(payPayment) recordHouseholdPayment(payPayment);
      if(editBudget) editBudgetForm(editBudget); if(delBudget) deleteItem('budgetEntries',delBudget);
      if(toggleGrocery) toggleGroceryDone(toggleGrocery); if(delGrocery) deleteItem('groceries',delGrocery);
      if(viewGPhoto) viewGroceryPhoto(viewGPhoto); if(delGPhoto) deleteGroceryPhoto(delGPhoto);
      if(editAi) editAiForm(editAi); if(delAi) deleteItem('aiEntries',delAi);
      if(editGItem) editGardenItemForm(editGItem); if(delGItem) deleteItem('gardenItems',delGItem); if(toggleGItem) toggleGardenItemDone(toggleGItem);
      if(editGLog) editGardenLogForm(editGLog); if(delGLog) deleteItem('gardenLogs',delGLog);
      if(editReward) editRewardForm(editReward); if(delReward) deleteItem('rewards',delReward);
      if(showChlog) showChangelog();
    }
    async function deleteItem(collection,id){
      if(!await confirmDialog('Opravdu smazat tuto položku?', {title:'Smazat položku', confirmText:'Smazat', danger:true})) return;
      state[collection] = Array.isArray(state[collection]) ? state[collection].filter(x=>x.id!==id) : []; save(); toast('Položka smazána.','warn');
    }
    async function deleteTransaction(id){
      const transaction=state.transactions.find(t=>t.id===id);
      if(!transaction) return;
      const paymentLinked=transaction.source==='payment'&&transaction.paymentId;
      const installmentLinked=transaction.source==='installment'&&transaction.installmentId;
      const linked=paymentLinked||installmentLinked;
      const message=paymentLinked
        ? 'Odpojit tento výdaj od uhrazeného účtu? Historie úhrady v Účtech a závazcích zůstane zachována, ale částka už nebude součástí finanční bilance.'
        : installmentLinked
          ? 'Odpojit tento výdaj od zaznamenané splátky? Historie ve Splátkovém kalendáři zůstane zachována, ale částka už nebude součástí finanční bilance.'
          : 'Opravdu smazat tuto transakci?';
      if(!await confirmDialog(message,{title:linked?'Odpojit finanční výdaj':'Smazat transakci',confirmText:linked?'Odpojit':'Smazat',danger:true})) return;
      if(paymentLinked){
        const payment=state.householdPayments.find(p=>p.id===transaction.paymentId);
        const historyEntry=payment?.paymentHistory?.find(h=>h.id===transaction.paymentHistoryId||h.transactionId===id);
        if(historyEntry) delete historyEntry.transactionId;
      }
      if(installmentLinked){
        const installment=state.installments.find(item=>item.id===transaction.installmentId);
        const historyEntry=installment?.paymentHistory?.find(h=>h.id===transaction.installmentHistoryId||h.transactionId===id);
        if(historyEntry){ delete historyEntry.transactionId; historyEntry.financeDetached=true; }
      }
      state.transactions=state.transactions.filter(t=>t.id!==id);
      save();
      toast(linked?'Výdaj byl odpojen; úhrada zůstala v příslušné historii.':'Transakce smazána.','warn');
    }

    // ===== Tooltipy, rozbalovací karty, plovoucí +, rychlé přidání =====
    function handleInfoAndAddCards(e){
      const fabAction = e.target.closest('[data-fab-action]');
      if(fabAction){ e.preventDefault(); runFabAction(fabAction); return; }
      if(!e.target.closest('#fabMenu') && !e.target.closest('#fab')) closeFabMenu();
      const dot = e.target.closest('.info-dot');
      const openDots = $$('.info-dot[data-open="true"]');
      openDots.forEach(d=>{ if(d!==dot) d.removeAttribute('data-open'); });
      if(dot){
        e.preventDefault();
        if(dot.getAttribute('data-open')==='true') dot.removeAttribute('data-open'); else dot.setAttribute('data-open','true');
        return;
      }
      const toggle = e.target.closest('[data-toggle-add]');
      if(toggle){ e.preventDefault(); toggleAddCard(toggle.dataset.toggleAdd); return; }
      const quick = e.target.closest('[data-quick]');
      if(quick){ e.preventDefault(); handleQuick(quick.dataset.quick); }
    }
    function toggleAddCard(id, forceOpen=false){
      const card = document.getElementById(id); if(!card) return;
      closeFabMenu();
      const willOpen = forceOpen || card.getAttribute('data-collapsed')==='true';
      card.setAttribute('data-collapsed', willOpen ? 'false' : 'true');
      if(willOpen){
        card.scrollIntoView({behavior:'smooth', block:'center'});
        const field = card.querySelector('input:not([type=hidden]), textarea, select');
        setTimeout(()=>field?.focus(), 220);
      }
    }
    const FAB_TARGET = {notes:'noteAddCard', tasks:'taskAddCard', shopping:'shopAddCard', vault:'vaultAddCard', installments:'instAddCard', payments:'paymentAddCard', budget:'budgetAddCard', ailog:'aiAddCard', rewards:'rewardAddCard'};
    const FAB_LABEL = {notes:'Nová poznámka', finance:'Přidat', tasks:'Nový úkol', shopping:'Nový velký nákup', vault:'Nový dokument', installments:'Nová splátka', payments:'Nová platba', apps:'Přidat', budget:'Zapsat útratu', groceries:'Přidat', ailog:'Zapsat činnost', rewards:'Přidat položku', garden:'Přidat'};
    const FAB_MENU = {
      finance:[
        {label:'Příjem nebo výdaj', target:'transAddCard'},
        {label:'Výplatní páska PDF', target:'payrollAddCard'}
      ],
      groceries:[
        {label:'Rychlá položka', focus:'#groceryName'},
        {label:'Hromadné vložení', target:'groceryBulkCard'},
        {label:'Fotka seznamu', input:'#groceryPhotoInput'}
      ],
      garden:[
        {label:'Věc k pořízení', target:'gardenItemAddCard'},
        {label:'Údržba / servis', target:'gardenLogAddCard'}
      ]
    };
    function activeTab(){ return document.querySelector('.view.active')?.id || 'dashboard'; }
    function closeFabMenu(){
      const menu = $('#fabMenu');
      if(menu){
        menu.hidden = true;
        menu.setAttribute('aria-hidden','true');
        menu.innerHTML = '';
      }
      $('#fab')?.setAttribute('aria-expanded','false');
    }
    function focusFabField(selector){
      const field = typeof selector==='string' ? document.querySelector(selector) : null;
      if(!field) return;
      closeFabMenu();
      field.scrollIntoView({behavior:'smooth', block:'center'});
      setTimeout(()=>field?.focus?.(), 220);
    }
    function openFabMenu(tab){
      const actions = FAB_MENU[tab];
      const menu = $('#fabMenu');
      if(!menu || !actions?.length) return false;
      const title = tab==='finance' ? 'Co chceš přidat ve Financích?' : tab==='groceries' ? 'Co chceš přidat do nákupního seznamu?' : 'Co chceš přidat na Zahradě?';
      menu.innerHTML = `<p class="fab-menu-title">${esc(title)}</p>` + actions.map((action,index)=>`<button type="button" data-fab-action="${index}"${action.target?` data-target="${action.target}"`:''}${action.focus?` data-focus="${action.focus}"`:''}${action.input?` data-input="${action.input}"`:''}>${esc(action.label)}</button>`).join('');
      menu.hidden = false;
      menu.setAttribute('aria-hidden','false');
      $('#fab')?.setAttribute('aria-expanded','true');
      return true;
    }
    function runFabAction(button){
      const target = button.dataset.target;
      const focus = button.dataset.focus;
      const input = button.dataset.input;
      if(target){ toggleAddCard(target, true); return; }
      if(focus){ focusFabField(focus); return; }
      if(input){ closeFabMenu(); document.querySelector(input)?.click(); }
    }
    function updateFab(tab){
      const fab = $('#fab'); if(!fab) return;
      const hasTarget = tab==='apps' || Object.prototype.hasOwnProperty.call(FAB_TARGET, tab) || Object.prototype.hasOwnProperty.call(FAB_MENU, tab);
      fab.hidden = !hasTarget;
      if(!hasTarget) closeFabMenu();
      const label = $('#fabLabel'); if(label) label.textContent = FAB_LABEL[tab] || 'Přidat';
    }
    function handleFabClick(){
      const tab = activeTab();
      if(FAB_MENU[tab]){
        const menu=$('#fabMenu');
        if(menu && !menu.hidden){ closeFabMenu(); return; }
        openFabMenu(tab);
        return;
      }
      if(tab==='apps'){
        if(selectedAppId) toggleAddCard('appNoteAddCard', true); else toggleAddCard('appAddCard', true);
        return;
      }
      const target = FAB_TARGET[tab];
      if(target) toggleAddCard(target, true);
    }
    function handleQuick(kind){
      const map = {task:'tasks', shopping:'shopping', trans:'finance', note:'notes', installment:'installments', grocery:'groceries', budget:'budget'};
      const tab = map[kind]; if(!tab) return;
      closeFabMenu();
      showTab(tab);
      if(tab==='groceries'){ setTimeout(()=>focusFabField('#groceryName'), 120); return; }
      if(tab==='finance'){ setTimeout(()=>toggleAddCard('transAddCard', true), 60); return; }
      const target = FAB_TARGET[tab];
      if(target) setTimeout(()=>toggleAddCard(target, true), 60);
    }

    function renderAll(){renderDashboard();renderNotes();renderFinance();renderVault();renderTasks();renderShopping();renderApps();renderInstallments();renderHouseholdPayments();renderBudget();renderGroceries();renderAiLog();renderRewards();renderGarden();renderPartner();renderBackupStatus();renderFooter();renderBiometricStatus();addAccessibilityLabels();}

    async function loadBiometricUnlockRecord(){
      try{
        biometricUnlockRecord = sanitizeBiometricRecord(await idbGetMeta(BIOMETRIC_META_KEY));
      }catch(error){
        console.warn('Biometrický záznam se nepodařilo načíst.', error);
        biometricUnlockRecord = null;
      }
      return biometricUnlockRecord;
    }
    async function refreshBiometricAvailability(){
      biometricPlatformAvailable = await isPlatformBiometricAvailable();
      renderBiometricStatus();
      return biometricPlatformAvailable;
    }
    function renderBiometricStatus(){
      const status=$('#biometricStatus');
      const info=$('#biometricInfo');
      const enable=$('#enableBiometricBtn');
      const remove=$('#removeBiometricBtn');
      const lockButton=$('#biometricUnlockBtn');
      const hasRecord=!!biometricUnlockRecord;
      if(lockButton){
        lockButton.hidden=!(hasEncryptedState()&&hasRecord&&biometricPlatformAvailable!==false&&!startupStorageError);
        lockButton.disabled=false;
      }
      if(status){
        status.textContent=hasRecord?'Aktivní na tomto zařízení':biometricPlatformAvailable===false?'Zařízení nepodporováno':'Není nastaveno';
        status.className=`status ${hasRecord?'good':biometricPlatformAvailable===false?'bad':'warn'}`;
      }
      if(info){
        info.textContent=hasRecord
          ? 'LifeHub lze odemknout otiskem prstu, rozpoznáním obličeje nebo zámkem telefonu. Hlavní heslo zůstává záložní možností.'
          : biometricPlatformAvailable===false
            ? 'Prohlížeč nebo zařízení neposkytuje bezpečný lokální autentizátor s podporou PRF. LifeHub bude dál používat hlavní heslo.'
            : 'Po aktivaci se hlavní šifrovací klíč uloží jen v podobě chráněné zámkem tohoto zařízení. Heslo se neukládá.';
      }
      if(enable){ enable.hidden=hasRecord; enable.disabled=biometricPlatformAvailable===false; }
      if(remove){ remove.hidden=!hasRecord; }
    }
    function biometricErrorText(error){
      if(error?.name==='NotAllowedError') return 'Ověření bylo zrušeno nebo zařízení otisk nepřijalo. Můžete použít hlavní heslo.';
      if(error?.name==='InvalidStateError') return 'Biometrický klíč už pro tuto aplikaci existuje nebo ho správce hesel odmítl vytvořit.';
      return error?.message||'Biometrické odemčení se nepodařilo.';
    }
    function scheduleAutomaticBiometricUnlock(){
      const attempt=++biometricGateAttempt;
      const tryStart=(remaining)=>{
        if(attempt!==biometricGateAttempt || appReady || biometricUnlockInProgress) return;
        if(!biometricUnlockRecord || !hasEncryptedState() || biometricPlatformAvailable===false || startupStorageError) return;
        if(document.visibilityState!=='visible' || (typeof document.hasFocus==='function' && !document.hasFocus())){
          if(remaining>0) setTimeout(()=>tryStart(remaining-1),300);
          return;
        }
        handleBiometricUnlock({auto:true});
      };
      setTimeout(()=>tryStart(8),250);
    }
    async function finishVaultUnlock({encrypted=true,method='password'}={}){
      biometricGateAttempt++;
      appReady = true;
      $('#lockScreen')?.classList.remove('active');
      document.body.classList.remove('locked');
      setAppInert(false);
      setTheme(state.settings.theme || 'dark');
      hydrateSettings();
      const migratedGroceries = migrateLegacyGroceries();
      const automaticPaymentsAdvanced = reconcileAutomaticHouseholdPayments();
      const payrollTransactionsReconciled = reconcilePayrollTransactions();
      const installmentTransactionsCreated = reconcileInstallmentTransactions();
      renderAll();
      refreshBiometricAvailability().catch(()=>{});
      lastActivityAt = Date.now();
      resetAutoLockTimer();
      saveLifecycle.reset();
      saveLifecycle.lastSavedAt = state.updatedAt || '';
      updateSaveUi();
      if(migratedGroceries || automaticPaymentsAdvanced || payrollTransactionsReconciled.changed || installmentTransactionsCreated) save(false);
      if(migratedGroceries) toast(`${migratedGroceries} položek potravin bylo přesunuto do nové záložky Nákupní seznam.`);
      if(automaticPaymentsAdvanced) toast(`Automatické platby byly posunuty podle termínů (${automaticPaymentsAdvanced}).`,'good');
      if(payrollTransactionsReconciled.created) toast(`Do financí byla doplněna chybějící výplata (${payrollTransactionsReconciled.created}).`,'good');
      if(installmentTransactionsCreated) toast(`Do financí bylo doplněno ${installmentTransactionsCreated} dříve zaznamenaných splátek.`,'good');
      const who = (state.settings.greetName||'').trim();
      if(method==='biometric') toast(`Odemčeno zámkem zařízení${who?', '+who:''}. 👋`,'good');
      else toast(encrypted ? `${greeting()}${who?', '+who:''}! 👋` : 'Šifrovaný trezor je připraven.');
      showInstallmentDebtOnOpen();
      maybeWeeklyInstallmentReminder();
    }
    async function handleBiometricUnlock(options={}){
      const automatic=options?.auto===true;
      if(biometricUnlockInProgress) return;
      const button=$('#biometricUnlockBtn');
      if(!biometricUnlockRecord||!hasEncryptedState()){
        $('#lockStatus').textContent='Biometrické odemčení není na tomto zařízení nastavené.';
        return;
      }
      biometricUnlockInProgress=true;
      if(button) button.disabled=true;
      $('#lockStatus').textContent=automatic?'Automaticky spouštím ověření otiskem nebo zámkem telefonu…':'Čekám na ověření otiskem nebo zámkem telefonu…';
      try{
        const envelope=encryptedStateEnvelope;
        if(envelope?.kind!=='LifeHub encrypted local state'||envelope?.crypto?.alg!=='AES-GCM') throw new Error('Lokální trezor má neplatný formát.');
        vaultSalt=b64ToBytes(envelope.crypto?.salt);
        vaultIterations=validateKdfIterations(envelope.crypto?.iterations);
        vaultKey=await unlockVaultKeyWithBiometrics(biometricUnlockRecord);
        const plain=await decryptObjectWithKey(envelope,vaultKey);
        state=sanitizeImportedState(plain,{preserveStoredFiles:true});
        await reconcileStoredFileFlags();
        await finishVaultUnlock({encrypted:true,method:'biometric'});
      }catch(error){
        console.error(error);
        vaultKey=null; vaultSalt=null; vaultIterations=KDF_ITERATIONS; appReady=false;
        $('#lockStatus').textContent=biometricErrorText(error);
      }finally{
        biometricUnlockInProgress=false;
        if(button) button.disabled=false;
      }
    }
    async function enableBiometricUnlock(){
      if(!appReady||!vaultKey){ toast('Nejdřív odemkněte LifeHub hlavním heslem.','warn'); return; }
      if(biometricUnlockRecord){ toast('Biometrické odemčení je už aktivní.','warn'); return; }
      const available=await refreshBiometricAvailability();
      if(!available){ toast('Toto zařízení bezpečné biometrické odemčení LifeHubu nepodporuje.','warn'); return; }
      const confirmed=await confirmDialog('Telefon může při odemykání použít otisk prstu, obličej, PIN, gesto nebo jiný zámek zařízení. Hlavní heslo zůstane zachované jako záloha. Aktivovat na tomto zařízení?',{title:'Aktivovat rychlé odemčení',confirmText:'Aktivovat'});
      if(!confirmed)return;
      const button=$('#enableBiometricBtn'); if(button)button.disabled=true;
      try{
        biometricUnlockRecord=await createBiometricRecord(vaultKey);
        await idbPutMeta(BIOMETRIC_META_KEY,biometricUnlockRecord);
        renderBiometricStatus();
        toast('Rychlé odemčení otiskem nebo zámkem zařízení je aktivní.','good');
      }catch(error){
        console.error(error);
        toast(biometricErrorText(error),'bad');
      }finally{ if(button)button.disabled=false; }
    }
    async function removeBiometricUnlock({quiet=false}={}){
      if(!biometricUnlockRecord){ if(!quiet)toast('Biometrické odemčení není aktivní.','warn'); return; }
      if(!quiet&&!await confirmDialog('Vypnout rychlé odemčení na tomto zařízení? Hlavní heslo ani data se nezmění.',{title:'Vypnout rychlé odemčení',confirmText:'Vypnout',danger:true}))return;
      await idbDeleteMeta(BIOMETRIC_META_KEY).catch(()=>{});
      biometricUnlockRecord=null;
      renderBiometricStatus();
      if(!quiet)toast('Rychlé odemčení bylo na tomto zařízení vypnuto.','warn');
    }

    async function startSecureGate(){
      await recoverPendingRestore();
      await recoverPendingKeyRotation();
      await loadEncryptedStateEnvelope();
      await loadBiometricUnlockRecord();
      biometricPlatformAvailable = await isPlatformBiometricAvailable();
      const screen = $('#lockScreen');
      if(!window.crypto?.subtle){
        $('#lockStatus').textContent = `Web Crypto API není dostupné. LifeHub ${SHORT_VERSION} vyžaduje moderní prohlížeč a bezpečný kontext.`;
        return;
      }
      screen?.classList.add('active');
      document.body.classList.add('locked');
      setAppInert(true);
      if(startupStorageError){
        $('#lockTitle').textContent = 'Lokální trezor nelze bezpečně načíst';
        $('#lockIntro').textContent = 'Nezadávejte nový PIN ani nemažte data aplikace.';
        $('#lockNote').textContent = 'Úložiště telefonu je dočasně nedostupné. Aplikaci úplně zavřete, zavřete případné další karty LifeHubu a znovu ji otevřete. Původní data se tím nepřepisují.';
        $('#lockStatus').textContent = startupStorageError.message;
        $('#lockRepeatWrap')?.classList.add('hide');
        $('#lockRememberWrap')?.classList.add('hide');
        $('#unlockBtn').disabled = true;
        $('#wipeEncryptedBtn')?.classList.add('hide');
        if($('#biometricUnlockBtn')) $('#biometricUnlockBtn').hidden=true;
        return;
      }
      $('#unlockBtn').disabled = false;
      const encrypted = hasEncryptedState();
      const legacy = hasLegacyState();
      const repeatWrap = $('#lockRepeatWrap');
      const migrateWrap = $('#lockRememberWrap');
      $('#lockPassword').value = '';
      $('#lockPasswordRepeat').value = '';
      if(encrypted){
        $('#lockTitle').textContent = 'Odemknout šifrovaný LifeHub';
        $('#lockIntro').textContent = biometricUnlockRecord ? 'Odemkněte LifeHub zámkem telefonu, nebo použijte hlavní heslo.' : 'Zadejte hlavní heslo. Bez něj se lokální data nenačtou.';
        const sourceNote = encryptedStateSource.startsWith('localstorage') ? ' Původní trezor byl nalezen a připraven k bezpečnému převodu.' : ' Původní šifrovaný trezor byl nalezen.';
        $('#lockNote').textContent = 'Stav aplikace, PDF i dokumenty jsou po odemčení uložené šifrovaně v IndexedDB.' + sourceNote;
        $('#unlockBtn').textContent = 'Odemknout';
        repeatWrap.classList.add('hide');
        migrateWrap.classList.add('hide');
        $('#wipeEncryptedBtn').classList.remove('hide');
        renderBiometricStatus();
      }else{
        $('#lockTitle').textContent = legacy ? 'Nastavit heslo a převést LifeHub 2.x' : 'Založit šifrovaný LifeHub';
        $('#lockIntro').textContent = legacy ? 'Našel jsem starší nešifrovaná data. Po nastavení hesla je převedu do šifrovaného úložiště.' : 'Nastavte heslo pro nový šifrovaný trezor.';
        $('#lockNote').textContent = 'Heslo se nikam neukládá. Když ho zapomenete, data nepůjde obnovit bez šifrované zálohy a správného hesla.';
        $('#unlockBtn').textContent = legacy ? 'Nastavit heslo a migrovat' : 'Založit trezor';
        repeatWrap.classList.remove('hide');
        migrateWrap.classList.toggle('hide', !legacy);
        $('#wipeEncryptedBtn').classList.add('hide');
        if($('#biometricUnlockBtn')) $('#biometricUnlockBtn').hidden=true;
      }
      setTimeout(()=>biometricUnlockRecord?$('#biometricUnlockBtn')?.focus():$('#lockPassword')?.focus(), 0);
      if(encrypted && biometricUnlockRecord && biometricPlatformAvailable!==false) scheduleAutomaticBiometricUnlock();
    }
    async function handleUnlockSubmit(e){
      e.preventDefault();
      const pass = $('#lockPassword').value;
      const repeat = $('#lockPasswordRepeat').value;
      const encrypted = hasEncryptedState();
      if(!pass){ $('#lockStatus').textContent = 'Zadejte heslo.'; return; }
      if(!encrypted && pass.length < MIN_PASSWORD_LENGTH){ $('#lockStatus').textContent = `Nové heslo musí mít alespoň ${MIN_PASSWORD_LENGTH} znaků.`; return; }
      $('#lockStatus').textContent = encrypted ? 'Ověřuji heslo…' : 'Zakládám šifrovaný trezor…';
      try{
        if(encrypted){
          const envelope = encryptedStateEnvelope;
          if(envelope?.kind !== 'LifeHub encrypted local state' || envelope?.crypto?.alg !== 'AES-GCM' || envelope?.crypto?.kdf !== 'PBKDF2-SHA256'){
            throw new Error('Lokální trezor má neplatný nebo nepodporovaný formát.');
          }
          vaultSalt = b64ToBytes(envelope.crypto?.salt);
          if(vaultSalt.byteLength < 16) throw new Error('Lokální trezor má neplatné kryptografické parametry.');
          const storedIterations = validateKdfIterations(envelope.crypto?.iterations);
          vaultIterations = storedIterations;
          vaultKey = await deriveVaultKey(pass, vaultSalt, storedIterations);
          const plain = await decryptObjectWithKey(envelope, vaultKey);
          state = sanitizeImportedState(plain, { preserveStoredFiles: true });
          await reconcileStoredFileFlags();
          if(encryptedStateSource !== 'indexeddb' || pendingLegacyEnvelopeCleanup){
            await persistEncryptedState(vaultKey, vaultSalt, state, vaultIterations);
          }
        }else{
          if(pass !== repeat){ $('#lockStatus').textContent = 'Hesla se neshodují.'; return; }
          vaultSalt = window.crypto.getRandomValues(new Uint8Array(16));
          vaultIterations = KDF_ITERATIONS;
          vaultKey = await deriveVaultKey(pass, vaultSalt, vaultIterations);
          const legacy = hasLegacyState();
          const migrate = legacy && $('#lockMigrateLegacy')?.checked;
          if(legacy && !migrate){
            const removeLegacy = await confirmDialog('Našel jsem starší nešifrovaná data, ale migrace není zaškrtnutá. Chcete starý nešifrovaný stav odstranit, aby nezůstal v prohlížeči jako plaintext?\n\nVolba „Zrušit“ přeruší založení trezoru a nechá stará data beze změny.', {title:'Starší nešifrovaná data', confirmText:'Smazat starý plaintext', danger:true});
            if(!removeLegacy){ $('#lockStatus').textContent = 'Založení trezoru bylo zrušeno. Starší nešifrovaná data zůstala beze změny.'; vaultKey = null; vaultSalt = null; vaultIterations = KDF_ITERATIONS; return; }
            try{ localStorage.removeItem(LEGACY_STORE); }catch(e){ console.warn(e); }
          }
          state = migrate ? sanitizeImportedState(loadLegacyState(), { preserveStoredFiles: true }) : defaultState();
          state.version = VERSION;
          state.createdAt = state.createdAt || new Date().toISOString();
          await persistEncryptedState();
          if(migrate){
            $('#lockStatus').textContent = 'Převádím starší lokální soubory do šifrovaného úložiště…';
            const migratedFiles = await encryptLegacyFiles();
            console.info(`LifeHub legacy file migration: ${migratedFiles} files processed.`);
          }
        }
        await finishVaultUnlock({encrypted,method:'password'});
      }catch(err){
        console.error(err);
        vaultKey = null; vaultSalt = null; vaultIterations = KDF_ITERATIONS; appReady = false;
        const wrongPassword = err?.name === 'OperationError' || /decrypt|operation/i.test(String(err?.message||''));
        $('#lockStatus').textContent = wrongPassword ? 'Odemčení selhalo. Zkontrolujte heslo.' : `Trezor nelze otevřít: ${err.message || 'neplatný formát'}`;
      }
    }
    function setAppInert(locked){
      const app = $('.app');
      if(!app) return;
      app.inert = !!locked;
      app.setAttribute('aria-hidden', locked ? 'true' : 'false');
    }
    function scrubSensitiveRuntime(){
      currentPayroll = {file:null, text:'', parsed:{}, evidence:{}};
      const pdfInput = $('#payrollPdf'); if(pdfInput) pdfInput.value = '';
      const rawText = $('#payrollRawText'); if(rawText) rawText.textContent = 'Zamčeno.';
      try{ fillPayrollFields({}); }catch(e){}
      ['noteForm','transactionForm','vaultForm','taskForm','shoppingForm','appForm','appNoteForm','instForm','paymentForm','budgetForm','budgetLimitsForm','groceryQuickForm','groceryBulkForm','aiForm','rewardForm','gardenItemForm','gardenLogForm'].forEach(id=>{ const form=document.getElementById(id); if(form) form.reset(); });
      ['noteId','transId','vaultId','taskId','shopId','appId','instId','budgetId','aiId','rewardId','gardenItemId','gardenLogId'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
      releaseGroceryPhotoUrls();
      const photoGrid = $('#groceryPhotoGrid'); if(photoGrid) photoGrid.innerHTML='';
      const photoInput = $('#groceryPhotoInput'); if(photoInput) photoInput.value='';
      selectedAppId = null;
      const preview = $('#markdownPreview'); if(preview) preview.textContent = '';
      const search = $('#globalSearch'); if(search) search.value = '';
      const results = $('#globalResults'); if(results) results.innerHTML = '';
      setPdfStatus('Zamčeno','warn');
    }
    async function lockApp(options={}){
      if(options instanceof Event) options={reason:'manual'};
      const {force=false, reason='manual'} = options || {};
      if(!appReady) return true;
      $('#saveStatus').textContent = 'Zamykám…';
      await saveInFlight.catch(()=>false);
      if(!force && saveLifecycle.blocksSafeLock){
        lockPendingAfterSave = reason === 'auto';
        showUnsavedGuard(reason === 'auto' ? 'Automatické zamknutí bylo pozastaveno, protože poslední změny nejsou uložené.' : 'Aplikaci nelze bezpečně zamknout, protože poslední změny nejsou uložené.');
        updateSaveUi();
        return false;
      }
      closeAllModals();
      hideUnsavedGuard();
      scrubSensitiveRuntime();
      appReady = false;
      vaultKey = null; vaultSalt = null; vaultIterations = KDF_ITERATIONS;
      state = defaultState();
      queuedSaveJob = null;
      saveLifecycle.reset();
      clearTimeout(autoLockTimer);
      $('#saveStatus').textContent = 'Zamčeno';
      $('#lockScreen')?.classList.add('active');
      document.body.classList.add('locked');
      setAppInert(true);
      await startSecureGate();
      return true;
    }
    function markActivity(){
      if(!appReady) return;
      lastActivityAt = Date.now();
      resetAutoLockTimer();
    }
    function resetAutoLockTimer(){
      if(!appReady) return;
      clearTimeout(autoLockTimer);
      const remaining = Math.max(0, AUTO_LOCK_MINUTES*60*1000 - (Date.now() - lastActivityAt));
      autoLockTimer = setTimeout(enforceAutoLock, remaining);
    }
    async function enforceAutoLock(){
      if(!appReady) return false;
      if(Date.now() - lastActivityAt >= AUTO_LOCK_MINUTES*60*1000){
        const locked = await lockApp({reason:'auto'});
        toast(locked ? 'Aplikace byla kvůli neaktivitě zamčena.' : 'Automatické zamknutí čeká na bezpečné uložení změn.', locked ? 'warn' : 'bad');
        return locked;
      }
      resetAutoLockTimer();
      return false;
    }
    function nativeFullscreenElement(){
      return document.fullscreenElement || document.webkitFullscreenElement || null;
    }
    function updateFullscreenButton(){
      const nativeActive=!!nativeFullscreenElement();
      const fallbackActive=fullscreenMode==='fallback' || document.body.classList.contains('focus-mode');
      const active=nativeActive || fallbackActive;
      const btn=$('#fullscreenBtn');
      if(!btn) return;
      btn.setAttribute('aria-pressed',String(active));
      btn.title=nativeActive?'Ukončit celou obrazovku':fallbackActive?'Ukončit rozšířený režim':'Celá obrazovka';
      btn.setAttribute('aria-label',btn.title);
      btn.textContent=active?'▣':'⛶';
    }
    function handleFullscreenChange(){
      if(nativeFullscreenElement()){
        fullscreenMode='native';
        document.body.classList.add('focus-mode');
      }else if(fullscreenMode==='native' || fullscreenMode==='native-pending'){
        fullscreenMode='none';
        document.body.classList.remove('focus-mode');
      }
      updateFullscreenButton();
      requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
    }
    async function requestNativeFullscreen(){
      const root=document.documentElement;
      if(typeof root.requestFullscreen==='function'){
        await root.requestFullscreen({navigationUI:'hide'});
        return;
      }
      if(typeof root.webkitRequestFullscreen==='function'){
        await Promise.resolve(root.webkitRequestFullscreen());
        return;
      }
      throw new Error('Tento prohlížeč nepodporuje režim celé obrazovky.');
    }
    async function exitNativeFullscreen(){
      const exit=document.exitFullscreen || document.webkitExitFullscreen;
      if(typeof exit!=='function') return;
      await Promise.resolve(exit.call(document));
    }
    async function toggleFullscreen(){
      if(nativeFullscreenElement() || fullscreenMode==='native'){
        try{
          await exitNativeFullscreen();
          if(!nativeFullscreenElement()){
            fullscreenMode='none';
            document.body.classList.remove('focus-mode');
            updateFullscreenButton();
          }
          toast('Režim celé obrazovky ukončen.');
        }catch(error){
          console.error(error);
          toast('Celou obrazovku se nepodařilo ukončit. Použijte systémové gesto Zpět.','bad');
        }
        return;
      }
      if(fullscreenMode==='fallback'){
        fullscreenMode='none';
        document.body.classList.remove('focus-mode');
        updateFullscreenButton();
        requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
        toast('Rozšířený režim ukončen.');
        return;
      }

      document.body.classList.add('focus-mode');
      fullscreenMode='native-pending';
      updateFullscreenButton();
      try{
        await requestNativeFullscreen();
        if(nativeFullscreenElement()){
          fullscreenMode='native';
          toast('Zapnut režim celé obrazovky.');
        }else{
          fullscreenMode='fallback';
          toast('Telefon ponechal systémové lišty, aplikace je alespoň v rozšířeném režimu.','warn');
        }
      }catch(error){
        console.warn('Nativní fullscreen nebyl povolen, používám CSS režim.',error);
        fullscreenMode='fallback';
        toast('Telefon nepovolil skutečnou celou obrazovku. Zapnut rozšířený režim.','warn');
      }
      updateFullscreenButton();
      requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
    }
    function trapLockFocus(e){
      const guard = $('#unsavedGuard');
      const screen = guard?.classList.contains('active') ? guard : $('#lockScreen');
      if(!screen?.classList.contains('active')) return;
      if(e.key === 'Escape'){
        e.preventDefault();
        (guard?.classList.contains('active') ? $('#guardRetrySaveBtn') : $('#lockPassword'))?.focus();
        return;
      }
      if(e.key !== 'Tab') return;
      const focusables = $$('button,input,select,textarea,a[href]', screen).filter(el=>!el.disabled && !el.classList.contains('hide') && el.offsetParent !== null);
      if(!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length-1];
      if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    }
    async function recoverPendingRestore(){
      let marker = null;
      try{ marker = await idbGetMeta('restoreImport'); }catch(error){ console.warn(error); }
      if(marker?.newEnvelope){
        await writeEncryptedStateEnvelope(marker.newEnvelope);
        await idbDeleteMeta('restoreImport').catch(()=>{});
      }else if(marker){ await idbDeleteMeta('restoreImport').catch(()=>{}); }
    }
    async function recoverPendingKeyRotation(){
      let marker = null;
      try{ marker = await idbGetMeta('keyRotation'); }catch(error){ console.warn(error); }
      if(marker?.newEnvelope){
        await writeEncryptedStateEnvelope(marker.newEnvelope);
        await idbDeleteMeta('keyRotation').catch(()=>{});
      }else if(marker){ await idbDeleteMeta('keyRotation').catch(()=>{}); }
    }
    async function changeVaultPassword(){
      if(!appReady || !vaultKey) return;
      const pass = await passwordDialog({title:'Změnit heslo trezoru', message:'Novým heslem se znovu zašifruje stav aplikace i všechny uložené PDF a dokumenty. Před změnou doporučujeme vytvořit kompletní zálohu.', repeat:true, minLength:MIN_PASSWORD_LENGTH, confirmText:'Změnit heslo'});
      if(!pass) return;
      if(!await confirmDialog('Opravdu změnit heslo? Během operace aplikaci nezavírejte. LifeHub použije transakční zápis, ale kompletní záloha je stále nejbezpečnější pojistka.', {title:'Potvrdit změnu hesla', confirmText:'Změnit heslo'})) return;
      $('#saveStatus').textContent = 'Měním heslo…';
      await saveInFlight.catch(()=>{});
      const oldKey = vaultKey;
      try{
        const newSalt = window.crypto.getRandomValues(new Uint8Array(16));
        const newIterations = KDF_ITERATIONS;
        const newKey = await deriveVaultKey(pass, newSalt, newIterations);
        const reencryptStore = async store => {
          const entries = await idbGetAllEntries(store);
          const output = [];
          for(const [id, raw] of entries){
            const file = raw?.kind === 'LifeHub encrypted blob' ? await cryptoDecryptBlobFromIdb(raw, oldKey) : raw;
            output.push([id, await cryptoEncryptBlobForIdb(file, newKey, VERSION)]);
          }
          return output;
        };
        const [payrollEntries, vaultEntries] = await Promise.all([reencryptStore(PDF_STORE), reencryptStore(VAULT_STORE)]);
        const snapshot = JSON.parse(JSON.stringify(state));
        const newEnvelope = await createEncryptedStateEnvelope(snapshot, newKey, newSalt, newIterations);
        const rotationId = uid('rotation');
        await idbReplaceEncryptedStores({payrollEntries, vaultEntries, rotationMarker:{rotationId, createdAt:new Date().toISOString(), newEnvelope}});
        await writeEncryptedStateEnvelope(newEnvelope);
        await idbDeleteMeta('keyRotation');
        vaultKey = newKey; vaultSalt = newSalt; vaultIterations = newIterations;
        await removeBiometricUnlock({quiet:true});
        $('#saveStatus').textContent = 'Heslo změněno';
        toast('Heslo trezoru bylo bezpečně změněno. Rychlé odemčení bylo vypnuto a lze ho znovu aktivovat v Nastavení.', 'good');
      }catch(error){
        console.error(error);
        await recoverPendingKeyRotation().catch(()=>{});
        $('#saveStatus').textContent = 'Změna hesla selhala';
        toast('Heslo se nepodařilo změnit: '+(error.message||error), 'bad');
      }
    }
    async function wipeEncryptedVault(){
      if(!await confirmDialog('Nouzově smazat šifrovaný trezor? Tato akce odstraní šifrovaný stav i lokální PDF/dokumenty. Bez zálohy nepůjde data obnovit.', {title:'Nouzové smazání trezoru', confirmText:'Smazat trezor', danger:true})) return;
      try{ await deleteEncryptedStateEnvelope(); localStorage.removeItem(LEGACY_STORE); await idbClear(PDF_STORE); await idbClear(VAULT_STORE); await idbDeleteMeta('keyRotation').catch(()=>{}); await idbDeleteMeta('restoreImport').catch(()=>{}); await idbDeleteMeta(BIOMETRIC_META_KEY).catch(()=>{}); }catch(e){ console.warn(e); }
      vaultKey = null; vaultSalt = null; vaultIterations = KDF_ITERATIONS; appReady = false; state = defaultState();
      $('#lockStatus').textContent = 'Trezor byl smazán. Nyní můžete založit nový.';
      await startSecureGate();
    }
    async function encryptBlobForIdb(file){
      return cryptoEncryptBlobForIdb(file, vaultKey, VERSION);
    }
    async function decryptBlobFromIdb(record){
      return cryptoDecryptBlobFromIdb(record, vaultKey);
    }
    async function encryptLegacyFiles(){
      let changed = 0;
      for(const p of state.payrolls.filter(x=>x.storedPdf)){
        try{
          const file = await idbGet(p.id, PDF_STORE);
          if(file && file.kind !== 'LifeHub encrypted blob'){ await idbPut(p.id, file, PDF_STORE); changed++; }
        }catch(e){ console.warn(e); }
      }
      for(const d of state.documents.filter(x=>x.storedFile !== false)){
        try{
          const file = await idbGet(d.id, VAULT_STORE);
          if(file && file.kind !== 'LifeHub encrypted blob'){ await idbPut(d.id, file, VAULT_STORE); changed++; }
        }catch(e){ console.warn(e); }
      }
      if(changed) toast(`Převedeno ${changed} lokálních souborů do šifrovaného úložiště.`);
      return changed;
    }
    function greeting(){
      const h = new Date().getHours();
      if(h < 5) return 'Dobrou noc';
      if(h < 10) return 'Dobré ráno';
      if(h < 12) return 'Dobré dopoledne';
      if(h < 18) return 'Dobré odpoledne';
      return 'Dobrý večer';
    }
    function renderDashboard(){
      renderSecurityPanel();
      const who = (state.settings.greetName||'').trim();
      const greetEl = $('#dashGreeting'); if(greetEl) greetEl.textContent = `${greeting()}${who?', '+who:''}!`;
      const dateEl = $('#dashDate');
      if(dateEl) dateEl.textContent = new Date().toLocaleDateString('cs-CZ',{weekday:'long',day:'numeric',month:'long'});
      renderDashboardFocus();
      const month = $('#financeMonth')?.value || monthNow();
      const year = Number($('#dashYear')?.value || currentYear());
      const m = projectedMonthSummary(month);
      const urgentTasks = state.tasks.filter(t=>!t.done && t.priority==='high').length;
      const urgentShop = state.shopping.filter(s=>s.status!=='bought' && s.priority==='urgent').reduce((a,s)=>a+number(s.price),0);
      const dashboardBalance=m.estimatedPayroll>0?m.projectedBalance:m.balance;
      const balanceClass = dashboardBalance>=0?'money-plus':'money-minus';
      $('#dashboardKpis').innerHTML = [
        kpi('Uložené poznámky', state.notes.length, 'AI vlákna, zdroje a nápady'),
        kpiHtml(m.estimatedPayroll>0?'Odhad bilance měsíce':'Bilance měsíce', `<span class="${balanceClass}">${esc(fmt(dashboardBalance))}</span>`, m.estimatedPayroll>0?`${monthLabel(month)} · mzda odhad ${fmt(m.estimatedPayroll)}`:monthLabel(month)),
        kpi('Vysoká priorita', urgentTasks, 'Nedokončené úkoly'),
        kpi('Urgentní nákupy', fmt(urgentShop), 'Aktivní plánované výdaje')
      ].join('');
      renderDashboardMonthlyFinance();
      renderAnnualChart('dashboardFinanceChart', year);
      renderPriorityBars();
      renderGlobalSearch();
    }
    function renderDashboardMonthlyFinance(){
      const box=$('#dashboardMonthlyFinance'); if(!box) return;
      const month=monthNow();
      const limits=budgetLimits();
      const summary=summarizeMonthlyFinancialPlan({
        month,
        transactions:state.transactions,
        payrolls:state.payrolls,
        budgetEntries:state.budgetEntries,
        householdPayments:state.householdPayments,
        installments:state.installments,
        foodBudget:limits.food,
        fuelBudget:limits.fuel
      });
      const salaryPeriodText=summary.salaryPeriods.length===1
        ? `Mzda za ${monthLabel(summary.salaryPeriods[0])}`
        : summary.salaryPeriods.length>1
          ? `Mzdy za ${summary.salaryPeriods.map(monthLabel).join(', ')}`
          : 'V tomto měsíci zatím není připsaná výplata';
      const remainingClass=summary.remainingAfterPlan>=0?'money-plus':'money-minus';
      box.innerHTML=`
        <div class="kpis monthly-finance-kpis">
          ${kpi('Připsaná výplata',fmt(summary.salaryCredited),salaryPeriodText)}
          ${kpi('Už utraceno',fmt(summary.actualSpent),`Finance ${fmt(summary.transactionExpenses)} + jídlo/benzín ${fmt(summary.budgetSpent)}`)}
          ${kpi('Ještě plánováno',fmt(summary.stillPlanned),`Účty, splátky a zbývající rozpočet`)}
          ${kpiHtml('Po všech výdajích',`<span class="${remainingClass}">${esc(fmt(summary.remainingAfterPlan))}</span>`,`Výplata − očekávané výdaje ${fmt(summary.totalExpectedExpenses)}`)}
        </div>
        <div class="monthly-finance-breakdown" aria-label="Rozpad měsíčních výdajů">
          <div><span>Již zapsané finanční výdaje</span><strong>${esc(fmt(summary.transactionExpenses))}</strong></div>
          <div><span>Jídlo a benzín – již utraceno</span><strong>${esc(fmt(summary.budgetSpent))}</strong></div>
          <div><span>Neuhrazené účty, faktury a trvalé příkazy</span><strong>${esc(fmt(summary.pendingPayments))}</strong></div>
          <div><span>Zbývající běžné splátky v tomto měsíci</span><strong>${esc(fmt(summary.pendingInstallments))}</strong></div>
          <div><span>Zbývající plán jídlo / benzín</span><strong>${esc(fmt(summary.remainingBudget))}</strong></div>
        </div>
        <p class="small monthly-finance-note">Souhrn používá výplatu skutečně připsanou v ${esc(monthLabel(month))}. U výdajů spojuje již provedené platby, ručně zapsané výdaje, jídlo a benzín i částky, které v tomto měsíci ještě čekají na úhradu.</p>`;
    }
    function renderDashboardFocus(){
      const box=$('#dashboardFocus'); if(!box) return;
      const todayIso=today();
      const soonDate=new Date(); soonDate.setDate(soonDate.getDate()+7);
      const soonIso=soonDate.toISOString().slice(0,10);
      const dueTasks=state.tasks.filter(t=>!t.done&&t.due&&t.due<=todayIso);
      const overdueTasks=dueTasks.filter(t=>t.due<todayIso);
      const duePayments=state.householdPayments.filter(p=>!p.automatic&&p.status!=='paid'&&p.dueDate&&p.dueDate<=soonIso);
      const groceryOpen=state.groceries.filter(g=>!g.done).length;
      const backupRaw=state.settings.lastCompleteBackupAt||'';
      let backupValue='Chybí'; let backupSub='Vytvořit první kompletní zálohu'; let backupTone='warn';
      if(backupRaw){
        const stamp=new Date(backupRaw).getTime();
        if(Number.isFinite(stamp)){
          const diff=Math.max(0,Math.floor((Date.now()-stamp)/86400000));
          backupValue=diff===0?'Dnes':diff===1?'Včera':`Před ${diff} dny`;
          backupSub=diff<=7?'Záloha je aktuální':'Doporučena nová záloha';
          backupTone=diff<=7?'good':'warn';
        }
      }
      const cards=[
        {icon:'✓',label:'Úkoly k řešení',value:String(dueTasks.length),sub:overdueTasks.length?`${overdueTasks.length} po termínu`:'Dnes nic nehoří',tab:'tasks',tone:overdueTasks.length?'bad':'good'},
        {icon:'₭',label:'Platby do 7 dní',value:String(duePayments.length),sub:duePayments.length?fmt(duePayments.reduce((sum,p)=>sum+number(p.amount),0)):'Bez ručních plateb',tab:'payments',tone:duePayments.some(p=>p.dueDate<todayIso)?'bad':'neutral'},
        {icon:'🛒',label:'Nákupní seznam',value:String(groceryOpen),sub:groceryOpen?'Položek zbývá koupit':'Seznam je prázdný',tab:'groceries',tone:'neutral'},
        {icon:'⬡',label:'Kompletní záloha',value:backupValue,sub:backupSub,tab:'exports',tone:backupTone}
      ];
      box.innerHTML=cards.map(card=>`<button class="focus-card ${card.tone}" data-jump="${attr(card.tab)}" type="button"><span class="focus-icon" aria-hidden="true">${esc(card.icon)}</span><span class="focus-copy"><small>${esc(card.label)}</small><strong>${esc(card.value)}</strong><em>${esc(card.sub)}</em></span><span class="focus-arrow" aria-hidden="true">→</span></button>`).join('');
    }

    function kpi(label,value,sub=''){return kpiText(label,value,sub);}
    function kpiText(label,value,sub=''){return `<div class="kpi"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div><div class="sub">${esc(sub)}</div></div>`}
    function kpiHtml(label,trustedHtml,sub=''){return `<div class="kpi"><div class="label">${esc(label)}</div><div class="value">${trustedHtml}</div><div class="sub">${esc(sub)}</div></div>`}
    function addAccessibilityLabels(){
      $$('input, textarea, select').forEach(el=>{
        if(el.hasAttribute('aria-label') || el.closest('label')) return;
        const label = el.getAttribute('placeholder') || el.getAttribute('title') || el.id || 'Ovládací prvek';
        el.setAttribute('aria-label', label);
      });
      $$('button[title]').forEach(btn=>{ if(!btn.hasAttribute('aria-label')) btn.setAttribute('aria-label', btn.getAttribute('title')); });
      $$('.nav button').forEach(btn=>{ if(!btn.hasAttribute('aria-label')) btn.setAttribute('aria-label', btn.textContent.trim() || btn.dataset.tab || 'Navigace'); });
    }
    function renderSecurityPanel(){
      const panel = $('#securityPanel'); if(!panel) return;
      const rawTexts = state.payrolls.filter(p=>String(p.rawText||'').trim()).length;
      const storedPdfs = state.payrolls.filter(p=>p.storedPdf).length;
      const localDocs = state.documents.length;
      const isSecureContext = window.isSecureContext || location.protocol === 'file:';
      const csp = !!document.querySelector('meta[http-equiv="Content-Security-Policy"]');
      const externalPdf = pdfJsSource === 'cdn';
      const pdfLazy = !window.pdfjsLib;
      const locked = !!vaultKey && appReady;
      const items = [
        [`${locked?'✅':'⚠️'} Šifrovaný stav`, locked ? 'Aplikace je odemčená heslem a stav se ukládá jako AES-GCM šifrovaný blok.' : 'Aplikace není odemčená; data se nenačítají.'],
        [`${storedPdfs||localDocs?'✅':'✅'} Lokální soubory`, `${storedPdfs} PDF výplatních pásek a ${localDocs} dokumentů je ukládáno šifrovaně po odemčení trezoru.`],
        [`${rawTexts?'⚠️':'✅'} Raw texty`, rawTexts ? `${rawTexts} výplatních pásek má uložený extrahovaný text. Je šifrovaný ve stavu aplikace, ale citlivý.` : 'Extrahovaný text z výplatních pásek není uložen.'],
        [`${isSecureContext?'✅':'⚠️'} Kontext`, isSecureContext ? 'HTTPS/file kontext dovoluje Web Crypto API.' : 'Aplikace neběží v bezpečném kontextu; šifrování může být omezené.'],
        [`${csp?'✅':'⚠️'} CSP`, csp ? 'Je nastavena základní Content Security Policy.' : 'Chybí Content Security Policy.'],
        [`${externalPdf?'⚠️':'✅'} PDF.js`, pdfLazy ? 'PDF.js se načte až při importu PDF z lokální vendor kopie; CDN fallback je odstraněn.' : (externalPdf ? 'PDF.js byl načten z externího zdroje, což by nemělo nastat.' : 'PDF.js byl načten z lokální kopie.')]
      ];
      const backupLabel=state.settings.lastCompleteBackupAt?fmtDate(state.settings.lastCompleteBackupAt):'zatím nevytvořena';
      panel.innerHTML = `<div class="security-summary-head"><div class="security-summary-title"><span class="security-shield" aria-hidden="true">◆</span><div><p class="eyebrow">Soukromí a bezpečnost</p><h3>LifeHub je odemčený a chráněný</h3><p>Kompletní záloha: <strong>${esc(backupLabel)}</strong></p></div></div><div class="actions security-actions"><button class="btn ok" data-action="export-complete-backup" type="button">Vytvořit zálohu</button><button class="btn" data-action="lock-app" type="button">Zamknout</button></div></div><div class="security-highlight-list">${items.slice(0,3).map(([h,t])=>`<div class="security-highlight"><strong>${esc(h)}</strong><span>${esc(t)}</span></div>`).join('')}</div><details class="security-details"><summary>Technické podrobnosti zabezpečení</summary><div class="security-list">${items.slice(3).map(([h,t])=>`<div class="security-item"><strong>${esc(h)}</strong><span class="small">${esc(t)}</span></div>`).join('')}</div></details>`;
    }
    function renderPriorityBars(){
      const openTasks = state.tasks.filter(t=>!t.done);
      const openShop = state.shopping.filter(s=>s.status!=='bought');
      const data = [
        ['Úkoly – vysoká priorita', openTasks.filter(t=>t.priority==='high').length, 'high'],
        ['Úkoly tento týden', openTasks.filter(t=>t.horizon==='week').length, 'mid'],
        ['Úkoly tento měsíc', openTasks.filter(t=>t.horizon==='month').length, 'mid'],
        ['Úkoly dlouhodobé', openTasks.filter(t=>t.horizon==='long').length, 'low'],
        ['Urgentní nákupy', openShop.filter(s=>s.priority==='urgent').length, 'high'],
        ['Nákupy brzy', openShop.filter(s=>s.priority==='soon').length, 'low']
      ];
      const max = Math.max(1,...data.map(d=>d[1]));
      $('#priorityBars').innerHTML = data.map(([label,val])=>barRow(label,val,Math.round(val/max*100),'')).join('') || empty('Zatím nejsou žádné priority.');
    }
    function renderGlobalSearch(){
      const q = strip($('#globalSearch')?.value || '');
      const box = $('#globalResults'); if(!box) return;
      if(!q){box.innerHTML='<div class="empty">Začněte psát a aplikace bude hledat v poznámkách, financích, úkolech i nákupech.</div>'; return;}
      const res = [];
      state.notes.forEach(n=>{const text=strip([n.title,n.summary,n.content,n.tags,n.source,n.type].join(' ')); if(text.includes(q)) res.push(['Poznámka',n.title,n.summary,'notes']);});
      state.transactions.forEach(t=>{const text=strip([t.category,t.description,t.amount,t.date].join(' ')); if(text.includes(q)) res.push(['Příjmy a výdaje',`${t.kind==='income'?'Příjem':'Výdaj'}: ${t.category}`,`${fmt(t.amount)} • ${t.date} • ${t.description||''}`,'finance']);});
      state.payrolls.forEach(p=>{const text=strip([p.month,p.employer,p.note,p.fileName,p.rawText].join(' ')); if(text.includes(q)) res.push(['Výplatní páska',`${p.month} ${p.employer||''}`,`Čistá mzda: ${fmt(payrollCleanAmount(p))} • Na účet: ${fmt(payrollAccountAmount(p))} • ${p.fileName || ''}`,'finance']);});
      state.documents.forEach(d=>{const text=strip([d.title,d.category,d.note,d.fileName].join(' ')); if(text.includes(q)) res.push(['Archiv',d.title,`${docCategoryLabel(d.category)} • ${d.fileName||''}`,'vault']);});
      state.tasks.forEach(t=>{const text=strip([t.title,t.note,t.area,t.priority].join(' ')); if(text.includes(q)) res.push(['Úkol',t.title,`${taskPriorityLabel(t.priority)} • ${t.area||''}`,'tasks']);});
      state.shopping.forEach(s=>{const text=strip([s.name,s.note,s.category,s.store,s.priority].join(' ')); if(text.includes(q)) res.push(['Velký nákup',s.name,`${shopPriorityLabel(s.priority)} • ${fmt(s.price)}`,'shopping']);});
      state.apps.forEach(a=>{const text=strip([a.name,a.note,a.tag,(a.notes||[]).map(x=>x.text).join(' ')].join(' ')); if(text.includes(q)) res.push(['Aplikace',a.name,`${a.tag||'aplikace'} • ${(a.notes||[]).length} poznámek`,'apps']);});
      state.installments.forEach(i=>{const text=strip([i.creditor,i.note].join(' ')); if(text.includes(q)){const c=computeInstallment(i); res.push(['Splátka',i.creditor,`zbývá ${fmt(c.remaining)} • měsíčně ${fmt(i.monthly)}`,'installments']);}});
      state.householdPayments.forEach(p=>{const text=strip([p.title,p.category,p.note,p.amount,p.dueDate,assignedToLabel(p.assignedTo)].join(' ')); if(text.includes(q)) res.push(['Platba domácnosti',p.title,`${fmt(p.amount)} • ${paymentFrequencyLabel(p.frequency)} • ${p.dueDate||'bez data'}`,'payments']);});
      state.groceries.forEach(g=>{const text=strip([g.name,g.store,g.note].join(' ')); if(text.includes(q)) res.push(['Nákupní seznam',g.name,`${g.store||'bez obchodu'}${g.done?' • koupeno':''}`,'groceries']);});
      state.budgetEntries.forEach(b=>{const text=strip([b.note,b.kind==='fuel'?'benzin':'jidlo',b.date].join(' ')); if(text.includes(q)) res.push(['Jídlo & benzín',`${b.kind==='fuel'?'Benzín':'Jídlo'}: ${fmt(b.amount)}`,`${b.date} • ${b.note||''}`,'budget']);});
      state.aiEntries.forEach(a=>{const text=strip([a.activity,a.note,a.date].join(' ')); if(text.includes(q)) res.push(['AI výkaz',a.activity,`${a.date} • ${minutesLabel(a.minutes)}`,'ailog']);});
      state.rewards.forEach(r=>{const text=strip([r.title,r.note].join(' ')); if(text.includes(q)) res.push(['Odměny',r.title,`${rewardPeriodLabel(r.period)} • ${fmtHours(r.hours)}`,'rewards']);});
      state.gardenItems.forEach(g=>{const text=strip([g.name,g.note].join(' ')); if(text.includes(q)) res.push(['Zahrada',g.name,`${gardenHorizonLabel(g.horizon)} • ${fmt(g.price)}${g.done?' • pořízeno':''}`,'garden']);});
      state.gardenLogs.forEach(g=>{const text=strip([g.area,g.note,gardenTypeLabel(g.type)].join(' ')); if(text.includes(q)) res.push(['Zahrada – údržba',gardenTypeLabel(g.type),`${g.date}${g.area?' • '+g.area:''}`,'garden']);});
      box.innerHTML = res.slice(0,30).map(r=>`<button class="result" type="button" data-jump="${r[3]}"><strong>${esc(r[0])}: ${esc(r[1])}</strong><span class="small">${esc(r[2])}</span></button>`).join('') || empty('Nic jsem nenašel. Zkuste jiné slovo nebo tag.');
    }

    function saveNote(e){
      e.preventDefault();
      const id = $('#noteId').value || uid('note');
      const existing = state.notes.find(n=>n.id===id);
      const n = {
        id, title:$('#noteTitle').value.trim(), source:$('#noteSource').value, priority:Number($('#notePriority').value), type:$('#noteType').value,
        model:$('#noteModel').value.trim(), url:safeUrl($('#noteUrl').value), tags:$('#noteTags').value.split(',').map(t=>t.trim()).filter(Boolean).slice(0,30),
        summary:$('#noteSummary').value.trim(), content:$('#noteContent').value.trim(), next:$('#noteNext').value.trim(),
        createdAt: existing?.createdAt || new Date().toISOString(), updatedAt:new Date().toISOString()
      };
      if(existing) Object.assign(existing,n); else state.notes.unshift(n);
      save(); resetNoteForm(); toast('Poznámka uložena.');
    }
    function resetNoteForm(){ $('#noteForm').reset(); $('#noteId').value=''; $('#notePriority').value='3'; }
    function editNoteForm(id){
      const n=state.notes.find(x=>x.id===id); if(!n) return;
      showTab('notes'); toggleAddCard('noteAddCard',true); $('#noteId').value=n.id; $('#noteTitle').value=n.title; $('#noteSource').value=n.source; $('#notePriority').value=n.priority; $('#noteType').value=n.type;
      $('#noteModel').value=n.model||''; $('#noteUrl').value=n.url||''; $('#noteTags').value=(n.tags||[]).join(', '); $('#noteSummary').value=n.summary||''; $('#noteContent').value=n.content||''; $('#noteNext').value=n.next||'';
      $('#noteTitle').focus();
    }
    function renderNotes(){
      populateNoteFilters();
      const q=strip($('#noteSearch')?.value||''), source=$('#noteSourceFilter')?.value||'all', type=$('#noteTypeFilter')?.value||'all', tag=$('#noteTagFilter')?.value||'all', sort=$('#noteSort')?.value||'new';
      let arr=state.notes.filter(n=>{
        const text=strip([n.title,n.summary,n.content,n.model,(n.tags||[]).join(' ')].join(' '));
        return (!q||text.includes(q)) && (source==='all'||n.source===source) && (type==='all'||n.type===type) && (tag==='all'||(n.tags||[]).includes(tag));
      });
      arr.sort((a,b)=> sort==='priority' ? b.priority-a.priority : sort==='title' ? a.title.localeCompare(b.title,'cs') : new Date(b.updatedAt)-new Date(a.updatedAt));
      $('#notesList').innerHTML = arr.map(noteCard).join('') || empty('Zatím tu nejsou poznámky. Uložte první užitečný výstup z AI vlákna.');
    }
    function noteCard(n){
      const stars='★'.repeat(Number(n.priority)||0);
      const url=safeUrl(n.url);
      return `<article class="item"><div class="item-top"><div><h4>${esc(n.title)}</h4><p>${esc(n.summary||'Bez shrnutí')}</p></div><div class="actions"><button class="mini-btn" data-view-note="${attr(n.id)}" type="button">Zobrazit</button><button class="mini-btn" data-edit-note="${attr(n.id)}" type="button">Upravit</button><button class="mini-btn" data-delete-note="${attr(n.id)}" type="button">Smazat</button></div></div><div class="meta"><span class="priority ${n.priority>=4?'high':n.priority>=3?'mid':'low'}">${stars||'★'} ${esc(n.source)}</span><span class="tag">${esc(n.type)}</span>${n.model?`<span class="tag">${esc(n.model)}</span>`:''}${(n.tags||[]).map(t=>`<span class="tag">#${esc(t)}</span>`).join('')}</div>${n.next?`<p><strong>Další krok:</strong> ${esc(n.next)}</p>`:''}${url?`<p><a href="${attr(url)}" target="_blank" rel="noopener noreferrer">Otevřít zdroj ↗</a></p>`:''}</article>`;
    }
    function openNoteDetail(id){
      const n = state.notes.find(x=>x.id===id); if(!n) return;
      const url = safeUrl(n.url);
      const stars = '★'.repeat(Number(n.priority)||0) || '★';
      const block = (title, text) => text ? `<div class="detail-block"><h4>${esc(title)}</h4><p class="detail-text">${esc(text)}</p></div>` : '';
      const meta = [n.source && `Zdroj: ${n.source}`, n.type && `Typ: ${n.type}`, `Priorita: ${stars}`, n.model && `Model: ${n.model}`, (n.tags||[]).length && `Tagy: ${(n.tags||[]).map(t=>'#'+t).join(', ')}`].filter(Boolean).join(' · ');
      const html = `<div class="detail-block"><h4>Přehled</h4><p class="detail-text">${esc(meta)}</p></div>`
        + block('Krátké shrnutí', n.summary)
        + block('Obsah / prompt / výstup', n.content)
        + block('Další krok', n.next)
        + (url ? `<div class="detail-block"><h4>Odkaz</h4><p class="detail-text"><a href="${attr(url)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a></p></div>` : '');
      openDetailModal(n.title || 'Poznámka', html);
    }
    function openDetailModal(title, innerHtml){
      const prev = document.activeElement;
      const screen = document.createElement('div');
      screen.className = 'modal-screen detail-modal active';
      screen.setAttribute('role','dialog'); screen.setAttribute('aria-modal','true');
      const card = document.createElement('div');
      card.className = 'modal-card';
      card.innerHTML = `<h2>${esc(title)}</h2>${innerHtml}<div class="modal-actions"><button class="btn primary" type="button" data-detail-close="1">Zavřít</button></div>`;
      screen.appendChild(card);
      document.body.appendChild(screen);
      const close = ()=>{ screen.remove(); try{prev?.focus?.();}catch(e){} };
      screen.addEventListener('click', ev=>{ if(ev.target===screen || ev.target.closest('[data-detail-close]')) close(); });
      screen.addEventListener('keydown', ev=>{ if(ev.key==='Escape'){ ev.preventDefault(); close(); } });
      setTimeout(()=>card.querySelector('[data-detail-close]')?.focus(),0);
    }
    function populateNoteFilters(){
      const sources=[...new Set(state.notes.map(n=>n.source).filter(Boolean))]; const types=[...new Set(state.notes.map(n=>n.type).filter(Boolean))]; const tags=[...new Set(state.notes.flatMap(n=>n.tags||[]))];
      fillSelect($('#noteSourceFilter'),'Všechny zdroje',sources); fillSelect($('#noteTypeFilter'),'Všechny typy',types); fillSelect($('#noteTagFilter'),'Všechny tagy',tags);
    }
    function fillSelect(sel,label,items,values=null){if(!sel)return; const old=sel.value; const entries=items.map((item,i)=>({label:String(item),value:String(values?values[i]:item)})).sort((a,b)=>a.label.localeCompare(b.label,'cs')); sel.innerHTML=`<option value="all">${label}</option>`+entries.map(x=>`<option value="${esc(x.value)}">${esc(x.label)}</option>`).join(''); sel.value=[...sel.options].some(o=>o.value===old)?old:'all';}

    function defaultPayrollPaymentDate(month){
      const match=/^(\d{4})-(\d{2})$/.exec(String(month||''));
      if(!match) return today();
      const date=new Date(Number(match[1]),Number(match[2]),10);
      return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
    }

    function payrollIncomeAmount(payroll){
      const fields=payroll?.fields||{};
      return Math.max(0,number(fields.netPay||fields.cleanPay||fields.grossPay));
    }
    function payrollTransactionDescription(payroll){
      return `Výplatní páska${payroll?.employer?' • '+payroll.employer:''}${payroll?.fileName?' • '+payroll.fileName:''}`;
    }
    function reconcilePayrollTransactions(){
      let created=0;
      let changed=0;
      const claimedTransactions=new Set();
      const payrolls=[...state.payrolls].sort((a,b)=>String(a?.createdAt||'').localeCompare(String(b?.createdAt||'')));
      for(const payroll of payrolls){
        const amount=payrollIncomeAmount(payroll);
        if(!(amount>0) || !/^\d{4}-\d{2}$/.test(String(payroll?.month||''))) continue;
        let paymentDate=/^\d{4}-\d{2}-\d{2}$/.test(String(payroll?.paymentDate||''))
          ? String(payroll.paymentDate)
          : defaultPayrollPaymentDate(payroll.month);
        // Před verzí 4.8.0 byla mzdová transakce vedena v účetním měsíci.
        // Migrace ji mohla označit jako odhad data připsání, přestože šlo o
        // datum ve stejném měsíci jako mzdové období. U takového výhradně
        // odhadovaného údaje použij standardní výplatní den následujícího měsíce.
        if(payroll.paymentDateEstimated===true && paymentDate.slice(0,7)===payroll.month){
          paymentDate=defaultPayrollPaymentDate(payroll.month);
        }
        if(payroll.paymentDate!==paymentDate){
          payroll.paymentDate=paymentDate;
          payroll.paymentDateEstimated=true;
          payroll.updatedAt=new Date().toISOString();
          changed++;
        }
        let transaction=state.transactions.find(row=>row?.source==='payroll'&&row?.payrollId===payroll.id&&!claimedTransactions.has(row.id));
        if(!transaction){
          transaction=state.transactions.find(row=>row?.source==='payroll'&&row?.payrollMonth===payroll.month&&!row?.payrollId&&!claimedTransactions.has(row.id));
        }
        const values={
          date:paymentDate,
          kind:'income',
          category:'mzda',
          amount,
          description:payrollTransactionDescription(payroll),
          source:'payroll',
          payrollId:payroll.id,
          payrollMonth:payroll.month,
          shared:false,
          updatedAt:new Date().toISOString()
        };
        if(transaction){
          const before=[transaction.date,transaction.kind,transaction.category,number(transaction.amount),transaction.description,transaction.source,transaction.payrollId,transaction.payrollMonth,transaction.shared].join('|');
          Object.assign(transaction,values);
          claimedTransactions.add(transaction.id);
          const after=[transaction.date,transaction.kind,transaction.category,number(transaction.amount),transaction.description,transaction.source,transaction.payrollId,transaction.payrollMonth,transaction.shared].join('|');
          if(before!==after) changed++;
        }else{
          const row={id:uid('trans'),...values,createdAt:new Date().toISOString()};
          state.transactions.unshift(row);
          claimedTransactions.add(row.id);
          created++;
          changed++;
        }
      }
      return {created,changed};
    }

    function renderPayrollFieldInputs(){
      $('#payrollFields').innerHTML = payFieldDefs.map(([key,label])=>`<label>${esc(label)}<input id="pay_${key}" data-pay-field="${attr(key)}" type="number" step="0.01" placeholder="nenalezeno"><small class="small" id="payproof_${attr(key)}">Bez důkazu z PDF.</small></label>`).join('');
    }
    function setPdfStatus(text, cls='warn'){const el=$('#pdfStatus'); el.textContent=text; el.className=`status ${cls}`;}
    function handlePayrollFileSelection(){
      const files=Array.from($('#payrollPdf')?.files||[]);
      if(!files.length){ setPdfStatus('PDF čeká na načtení','warn'); return; }
      if(files.length===1){ parsePayrollPdf(); return; }
      currentPayroll={file:null,text:'',parsed:{},evidence:{}};
      fillPayrollFields({});
      $('#payrollRawText').textContent=`Vybráno ${files.length} souborů. Použijte tlačítko „Hromadně uložit vybraná PDF“.`;
      setPdfStatus(`Vybráno ${files.length} PDF`,'good');
    }
    async function importPayrollPdfBatch(){
      const selected=Array.from($('#payrollPdf')?.files||[]);
      if(!selected.length){ toast('Nejdřív vyberte jedno nebo více PDF výplatních pásek.','warn'); return; }
      const invalid=selected.filter(file=>!((file.type==='application/pdf')||String(file.name||'').toLowerCase().endsWith('.pdf')) || file.size>MAX_PDF_SIZE_BYTES);
      if(invalid.length){ toast(`${invalid.length} souborů není platné PDF nebo překračuje povolenou velikost.`,'bad'); return; }
      const parsedRows=[];
      const failures=[];
      const seenMonths=new Set();
      for(let index=0; index<selected.length; index++){
        const file=selected[index];
        setPdfStatus(`Čtu ${index+1}/${selected.length}: ${file.name}`,'warn');
        try{
          const text=await extractPdfText(file);
          const parsed=parsePayrollText(text);
          const month=parsed.month||'';
          const amount=number(parsed.fields?.cleanPay||parsed.fields?.netPay||parsed.fields?.grossPay);
          if(!/^\d{4}-\d{2}$/.test(month) || !(amount>0)){
            failures.push(`${file.name}: chybí měsíc nebo čistá/hrubá mzda`);
            continue;
          }
          if(seenMonths.has(month)){
            failures.push(`${file.name}: měsíc ${month} je ve výběru dvakrát`);
            continue;
          }
          seenMonths.add(month);
          parsedRows.push({file,text,month,employer:parsed.employer||'',note:Array.isArray(parsed.hints)?parsed.hints.join('; '):'',fields:parsed.fields||{},evidence:parsed.evidence||{},found:parsed.found||0});
        }catch(error){
          console.error(error);
          failures.push(`${file.name}: ${error.message||error}`);
        }
      }
      if(!parsedRows.length){ setPdfStatus('Žádné PDF nelze importovat','bad'); toast('V žádném vybraném PDF se nepodařilo najít platnou výplatní pásku.','bad'); return; }
      parsedRows.sort((a,b)=>a.month.localeCompare(b.month));
      const replaceExisting=!!$('#payReplaceMonth')?.checked;
      const existingMonths=new Set(state.payrolls.map(row=>row.month));
      const rows=replaceExisting?parsedRows:parsedRows.filter(row=>!existingMonths.has(row.month));
      const skipped=parsedRows.length-rows.length;
      if(!rows.length){ setPdfStatus('Všechny měsíce už existují','warn'); toast('Všechny rozpoznané měsíce už v aplikaci existují. Zapněte „Nahradit starší mzdový příjem“, pokud je chcete načíst znovu.','warn'); return; }
      const storePdf=!!$('#payStorePdf')?.checked;
      const storeText=!!$('#payStoreText')?.checked;
      const summary=rows.map(row=>{ const clean=number(row.fields.cleanPay||row.fields.netPay||row.fields.grossPay); const account=number(row.fields.netPay||clean); return `- ${monthLabel(row.month)}: čistá mzda ${fmt(clean)}${account!==clean?` • na účet ${fmt(account)}`:''} • ${row.found} rozpoznaných hodnot${existingMonths.has(row.month)?' • nahradí stávající záznam':''}`; }).join('\n');
      const extras=[
        storePdf?'PDF budou uložena šifrovaně pouze v tomto zařízení.':'PDF se neuloží; zůstanou jen vyčtené částky.',
        skipped?`${skipped} existujících měsíců bude přeskočeno.`:'',
        failures.length?`${failures.length} souborů se nepodařilo připravit a nebude importováno.`:''
      ].filter(Boolean).join('\n');
      const ok=await confirmDialog(`Hromadně uložit ${rows.length} výplatních pásek?\n\n${summary}\n\n${extras}`,{title:'Hromadný import výplatních pásek',confirmText:'Uložit pásky'});
      if(!ok){ setPdfStatus(`Připraveno ${rows.length} PDF`,'warn'); return; }
      let storedCount=0;
      let fileFailures=0;
      for(let index=0; index<rows.length; index++){
        const row=rows[index];
        setPdfStatus(`Ukládám ${index+1}/${rows.length}: ${monthLabel(row.month)}`,'warn');
        const oldRows=state.payrolls.filter(p=>p.month===row.month);
        const id=uid('payroll');
        const paymentDate=defaultPayrollPaymentDate(row.month);
        const record={id,month:row.month,paymentDate,paymentDateEstimated:true,employer:row.employer,note:row.note,fileName:row.file.name,fileSize:row.file.size,fields:sanitizePayrollFields(row.fields),evidence:sanitizeEvidence(row.evidence),rawText:storeText?row.text:'',storedPdf:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
        if(storePdf){
          try{ await idbPut(id,row.file); record.storedPdf=true; storedCount++; }
          catch(error){ console.error(error); fileFailures++; }
        }
        if(replaceExisting && oldRows.length){
          for(const old of oldRows){ if(old.storedPdf) await idbDelete(old.id,PDF_STORE).catch(()=>{}); }
          state.payrolls=state.payrolls.filter(p=>p.month!==row.month);
          state.transactions=state.transactions.filter(t=>!(t.source==='payroll'&&t.payrollMonth===row.month));
        }
        state.payrolls.unshift(record);
        state.transactions.unshift({id:uid('trans'),date:paymentDate,kind:'income',category:'mzda',amount:record.fields.netPay||record.fields.cleanPay||record.fields.grossPay||0,description:`Výplatní páska${record.employer?' • '+record.employer:''}${record.fileName?' • '+record.fileName:''}`,source:'payroll',payrollId:id,payrollMonth:row.month,shared:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
      }
      state.payrolls.sort((a,b)=>String(b.month).localeCompare(String(a.month)));
      save();
      clearPayrollImport();
      const warning=fileFailures?` U ${fileFailures} pásek se nepodařilo uložit samotné PDF, částky však zůstaly zachovány.`:'';
      const failedText=failures.length?` ${failures.length} neplatných souborů bylo přeskočeno.`:'';
      setPdfStatus(`Uloženo ${rows.length} pásek`,'good');
      toast(`Hromadně uloženo ${rows.length} výplatních pásek${storePdf?` (${storedCount} PDF šifrovaně)`:''}.${warning}${failedText}`,fileFailures||failures.length?'warn':'good');
    }
    async function parsePayrollPdf(){
      const files=Array.from($('#payrollPdf').files||[]);
      if(files.length>1){ toast('Pro kontrolu jednoho souboru vyberte pouze jedno PDF, nebo použijte hromadný import.','warn'); return; }
      const file = files[0];
      if(!file){toast('Nejdřív vyberte PDF výplatní pásku.','warn'); return;}
      const isPdf = file.type === 'application/pdf' || String(file.name||'').toLowerCase().endsWith('.pdf');
      if(!isPdf){ $('#payrollPdf').value=''; toast('Vybraný soubor není PDF.','bad'); return; }
      if(file.size > MAX_PDF_SIZE_BYTES){ $('#payrollPdf').value=''; toast(`PDF je příliš velké. Limit je ${(MAX_PDF_SIZE_BYTES/1024/1024).toFixed(0)} MB.`, 'bad'); return; }
      setPdfStatus('Čtu PDF…','warn'); $('#payrollRawText').textContent='Probíhá čtení PDF…';
      try{
        const text = await extractPdfText(file);
        currentPayroll = {file, text:'', parsed:{}, evidence:{}};
        currentPayroll.text = text;
        $('#payrollRawText').textContent = text || 'PDF neobsahuje čitelnou textovou vrstvu.';
        const parsed = parsePayrollText(text);
        currentPayroll.parsed = parsed.fields;
        currentPayroll.evidence = parsed.evidence || {};
        fillPayrollFields(parsed.fields, parsed.evidence);
        const monthInput=$('#payMonth'); if(parsed.month && monthInput) monthInput.value=parsed.month;
        const paidInput=$('#payPaidDate'); if(parsed.month && paidInput && !paidInput.value) paidInput.value=defaultPayrollPaymentDate(parsed.month);
        const empInput=$('#payEmployer'); if(parsed.employer && empInput && !empInput.value.trim()) empInput.value=parsed.employer;
        const noteInput=$('#payNote'); if(Array.isArray(parsed.hints) && parsed.hints.length && noteInput && !noteInput.value.trim()) noteInput.value=parsed.hints.join('; ');
        if(text.trim().length < 80){
          setPdfStatus('Pravděpodobně sken bez OCR','bad');
          toast('PDF skoro neobsahuje text. U skenu je potřeba OCR nebo ruční zadání hodnot.','bad');
        }else if(parsed.found >= 5){
          setPdfStatus(`Rozpoznáno ${parsed.found} hodnot`, 'good'); toast('PDF přečteno. Zkontrolujte nalezené částky a uložte pásku.');
        }else{
          setPdfStatus(`Rozpoznáno jen ${parsed.found} hodnot`, 'warn'); toast('PDF přečteno, ale některé hodnoty chybí. Doplňte je ručně.','warn');
        }
      }catch(err){console.error(err); currentPayroll={file:null,text:'',parsed:{},evidence:{}}; setPdfStatus('Čtení PDF selhalo','bad'); $('#payrollRawText').textContent=String(err.message||err); toast('PDF se nepodařilo přečíst. Zkuste jiné PDF nebo ruční zadání.','bad');}
    }
    async function ensurePdfJs(){
      if(pdfjsLibRef) return pdfjsLibRef;
      try{
        pdfjsLibRef = await import(PDF_JS_LOCAL);
        pdfJsSource = 'local';
        pdfjsLibRef.GlobalWorkerOptions.workerSrc = PDF_WORKER_LOCAL;
        return pdfjsLibRef;
      }catch(err){
        console.error(err);
        throw new Error('Knihovna PDF.js se nenačetla z lokální složky vendor. Zkontrolujte, že jsou v balíčku soubory vendor/pdf.min.mjs a vendor/pdf.worker.min.mjs.');
      }
    }
    async function extractPdfText(file){
      if(!file) throw new Error('Chybí PDF soubor.');
      const isPdf = file.type === 'application/pdf' || String(file.name||'').toLowerCase().endsWith('.pdf');
      if(!isPdf) throw new Error('Soubor není PDF.');
      if(file.size > MAX_PDF_SIZE_BYTES) throw new Error(`PDF je příliš velké. Limit je ${(MAX_PDF_SIZE_BYTES/1024/1024).toFixed(0)} MB.`);
      const pdfjsLib = await ensurePdfJs();
      const buffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({data:buffer, isEvalSupported:false, stopAtErrors:true}).promise;
      const pages=[];
      const maxPages = Math.min(pdf.numPages, MAX_PDF_PAGES);
      for(let i=1;i<=maxPages;i++){
        const page=await pdf.getPage(i);
        const content=await page.getTextContent();
        pages.push(linesFromTextItems(content.items).join('\n'));
      }
      if(pdf.numPages > MAX_PDF_PAGES) pages.push(`[Zkráceno: přečteno prvních ${MAX_PDF_PAGES} z ${pdf.numPages} stran.]`);
      return pages.join('\n\n--- strana ---\n\n');
    }
    function linesFromTextItems(items){
      const arr = items.map(it=>({s:it.str,x:it.transform?.[4]||0,y:it.transform?.[5]||0})).filter(it=>it.s && it.s.trim());
      arr.sort((a,b)=> Math.abs(b.y-a.y)>3 ? b.y-a.y : a.x-b.x);
      const lines=[];
      arr.forEach(it=>{
        const last=lines[lines.length-1];
        if(!last || Math.abs(last.y-it.y)>3) lines.push({y:it.y, parts:[it]}); else last.parts.push(it);
      });
      return lines.map(l=>l.parts.sort((a,b)=>a.x-b.x).map(p=>p.s).join(' ').replace(/\s+/g,' ').trim()).filter(Boolean);
    }
    function parsePayrollText(text){
      // Pásky ze systému Elanor mají souhrn ve 4 sloupcích „popisek hodnota" na jednom
      // řádku; obecné hledání „poslední částky u popisku" tam vrací špatné hodnoty.
      if(isElanorPayslip(text)){
        const el = parseElanorPayslip(text);
        if(el.found >= 5) return el;
      }
      const fields={}; const evidence={}; let found=0;
      for(const [key,,patterns] of payFieldDefs){
        const result = findAmountNear(text, patterns);
        if(result && result.value !== null && isFinite(result.value)){ fields[key]=result.value; evidence[key]=result; found++; }
      }
      return {fields, evidence, found};
    }
    function findAmountNear(text, labels){
      const amount = '[-+]?\\d{1,3}(?:[ \\.]\\d{3})*(?:,\\d{1,2})?|[-+]?\\d+(?:,\\d{1,2})?';
      const lines = String(text||'').split(/\r?\n/).map(line=>line.replace(/\s+/g,' ').trim()).filter(Boolean);
      for(const rawLabel of labels){
        const label = strip(rawLabel);
        for(let i=0;i<lines.length;i++){
          const normalized = strip(lines[i]);
          if(!normalized.includes(label)) continue;
          const windowText = [lines[i], lines[i+1]||''].join(' | ');
          const values = Array.from(windowText.matchAll(new RegExp(amount,'g'))).map(m=>parseCzechAmount(m[0])).filter(v=>v!==null && Math.abs(v)<10000000);
          if(values.length){
            const value = values[values.length-1];
            return {value, label:rawLabel, snippet:windowText.slice(0,220), confidence:i+1<lines.length?'střední':'vysoká'};
          }
        }
      }
      const clean = strip(text).replace(/\u00a0/g,' ');
      for(const label of labels.map(strip)){
        const escaped = label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+');
        const patterns = [
          new RegExp(`${escaped}[^\\d+-]{0,90}(${amount})`,'i'),
          new RegExp(`${escaped}.{0,120}?(${amount})\\s*(kc|czk)?`,'i'),
          new RegExp(`(${amount})[^\\n]{0,70}${escaped}`,'i')
        ];
        for(const re of patterns){
          const m = clean.match(re);
          if(m){ const val = parseCzechAmount(m[1]); if(val!==null && Math.abs(val)<10000000) return {value:val,label,snippet:m[0].slice(0,220),confidence:'nízká'}; }
        }
      }
      return null;
    }
    function parseCzechAmount(s){
      if(!s) return null;
      let x=String(s).replace(/[^0-9,\.\-+ ]/g,'').trim();
      if(!x) return null;
      const comma=x.lastIndexOf(','), dot=x.lastIndexOf('.');
      if(comma>-1 && dot>-1){ x = comma>dot ? x.replace(/\./g,'').replace(',','.') : x.replace(/,/g,''); }
      else if(comma>-1){ x=x.replace(/\s/g,'').replace(',','.'); }
      else { x=x.replace(/\s/g,'').replace(/\.(?=\d{3}(\D|$))/g,''); }
      const n=Number(x); return Number.isFinite(n)?n:null;
    }
    function fillPayrollFields(fields, evidence={}){
      payFieldDefs.forEach(([key])=>{
        const el=$(`#pay_${key}`); if(el) el.value = fields[key] ?? '';
        const proof=$(`#payproof_${key}`);
        if(proof){
          const ev=evidence[key];
          proof.textContent = ev ? `Důkaz: ${ev.label} • jistota ${ev.confidence} • ${ev.snippet}` : 'Bez důkazu z PDF; případně doplňte ručně.';
        }
      });
    }
    function readPayrollFields(){
      const fields={}; payFieldDefs.forEach(([key])=>{const v=$(`#pay_${key}`)?.value; if(v!=='' && v!=null) fields[key]=number(v);}); return fields;
    }
    function clearPayrollImport(){
      currentPayroll = {file:null,text:'',parsed:{},evidence:{}}; $('#payrollPdf').value=''; $('#payrollRawText').textContent='Zatím není načteno žádné PDF.'; $('#payStorePdf').checked = true; $('#payStoreText').checked = false; if($('#payPaidDate')) $('#payPaidDate').value=today(); fillPayrollFields({}); setPdfStatus('PDF čeká na načtení','warn');
    }
    async function savePayrollRecord(){
      const fields = readPayrollFields(); const month = $('#payMonth').value; const paymentDate=$('#payPaidDate')?.value||defaultPayrollPaymentDate(month);
      if(!month){toast('Vyberte mzdové období.','warn'); return;}
      if(!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)){toast('Zadejte platné datum připsání mzdy na účet.','warn'); return;}
      if(!fields.cleanPay && !fields.netPay && !fields.grossPay){toast('Doplňte alespoň čistou nebo hrubou mzdu.','warn'); return;}
      if($('#payReplaceMonth').checked){
        const existingPayrollIncome = state.transactions.filter(t=>t.source==='payroll' && t.payrollMonth===month);
        if(existingPayrollIncome.length){
          const detail = existingPayrollIncome.map(t=>`${t.date || month}: ${t.description || t.category} (${fmt(t.amount)})`).join('\n');
          if(!await confirmDialog(`Ve vybraném měsíci už existují mzdové příjmy, které by byly nahrazeny:

${detail}

Pokračovat?`, {title:'Nahradit mzdový příjem', confirmText:'Nahradit', danger:true})) return;
        }
      }
      const id = uid('payroll');
      const record = {id, month, paymentDate, paymentDateEstimated:false, employer:$('#payEmployer').value.trim(), note:$('#payNote').value.trim(), fileName:currentPayroll.file?.name||'', fileSize:currentPayroll.file?.size||0, fields, evidence: sanitizeEvidence(currentPayroll.evidence || {}), rawText: $('#payStoreText').checked ? currentPayroll.text : '', storedPdf:false, createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
      if($('#payStorePdf').checked && currentPayroll.file){
        try{ await idbPut(id,currentPayroll.file); record.storedPdf=true; }
        catch(e){ console.error(e); toast('PDF se nepodařilo uložit do IndexedDB. Ukládám alespoň vyčtené částky bez PDF kopie.','warn'); }
      }
      if($('#payReplaceMonth').checked){
        state.transactions = state.transactions.filter(t=>!(t.source==='payroll' && t.payrollMonth===month));
      }
      state.payrolls.unshift(record);
      state.transactions.unshift({id:uid('trans'), date:paymentDate, kind:'income', category:'mzda', amount:fields.netPay || fields.cleanPay || fields.grossPay || 0, description:`Výplatní páska${record.employer?' • '+record.employer:''}${record.fileName?' • '+record.fileName:''}`, source:'payroll', payrollId:id, payrollMonth:month, shared:false, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString()});
      save(); clearPayrollImport(); toast('Výplatní páska uložena. Bilance ji počítá k mzdovému období, hotovostní tok k datu připsání.');
    }
    // Additivní import výplatních pásek z JSON souboru. Na rozdíl od záloh nic
    // nenahrazuje: pásky přidá k současným datům a měsíce, které už existují, přeskočí.
    async function importPayrollsJson(e){
      const file=e.target.files?.[0];
      e.target.value='';
      if(!file) return;
      try{
        if(file.size > 2*1024*1024) throw new Error('Soubor je příliš velký pro import pásek.');
        const data=JSON.parse(await file.text());
        if(hasForbiddenKeys(data)) throw new Error('Soubor obsahuje zakázané klíče.');
        if(data?.kind!=='LifeHub payroll import' || !Array.isArray(data.payrolls)) throw new Error('Soubor není import výplatních pásek LifeHubu (kind: „LifeHub payroll import").');
        const incoming=data.payrolls.slice(0,120).map(p=>({
          month:textLimit(p?.month,7), paymentDate:textLimit(p?.paymentDate,10), employer:textLimit(p?.employer,160), note:textLimit(p?.note,1000), fields:sanitizePayrollFields(p?.fields||{})
        })).filter(p=>/^\d{4}-\d{2}$/.test(p.month) && (p.fields.cleanPay || p.fields.netPay || p.fields.grossPay));
        if(!incoming.length) throw new Error('Soubor neobsahuje žádnou platnou pásku (měsíc + čistá nebo hrubá mzda).');
        const existing=new Set(state.payrolls.map(p=>p.month));
        const toAdd=incoming.filter(p=>!existing.has(p.month)).sort((a,b)=>a.month.localeCompare(b.month));
        const skipped=incoming.length-toAdd.length;
        if(!toAdd.length){ toast(`Všech ${incoming.length} měsíců už v aplikaci existuje. Nic nebylo přidáno.`,'warn'); return; }
        const summary=toAdd.map(p=>{ const clean=number(p.fields.cleanPay||p.fields.netPay||p.fields.grossPay); const account=number(p.fields.netPay||clean); return `- ${monthLabel(p.month)}: čistá mzda ${fmt(clean)}${account!==clean?` • na účet ${fmt(account)}`:''}`; }).join('\n');
        const ok=await confirmDialog(`Přidat ${toAdd.length} výplatních pásek a zapsat je do příjmů?\n\n${summary}${skipped?`\n\n${skipped} měsíců bylo přeskočeno, protože už existují.`:''}\n\nSoučasná data zůstanou beze změny.`, {title:'Import výplatních pásek', confirmText:'Přidat pásky'});
        if(!ok) return;
        toAdd.forEach(p=>{
          const id=uid('payroll');
          const paymentDate=/^\d{4}-\d{2}-\d{2}$/.test(p.paymentDate)?p.paymentDate:defaultPayrollPaymentDate(p.month);
          state.payrolls.unshift({id, month:p.month, paymentDate, paymentDateEstimated:!p.paymentDate, employer:p.employer, note:p.note, fileName:'', fileSize:0, fields:p.fields, evidence:{}, rawText:'', storedPdf:false, createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
          state.transactions.unshift({id:uid('trans'), date:paymentDate, kind:'income', category:'mzda', amount:p.fields.netPay||p.fields.cleanPay||p.fields.grossPay||0, description:`Výplatní páska${p.employer?' • '+p.employer:''}`, source:'payroll', payrollId:id, payrollMonth:p.month,shared:false, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString()});
        });
        state.payrolls.sort((a,b)=>String(b.month).localeCompare(String(a.month)));
        save();
        toast(`Přidáno ${toAdd.length} výplatních pásek včetně příjmů.${skipped?` ${skipped} existujících měsíců přeskočeno.`:''}`,'good');
      }catch(err){ console.error(err); toast('Import pásek se nepodařil: '+(err.message||err),'bad'); }
    }
    function transactionAccountingMonth(transaction){
      if(transaction?.source==='payroll' && /^\d{4}-\d{2}$/.test(String(transaction.payrollMonth||''))) return transaction.payrollMonth;
      return String(transaction?.date||'').slice(0,7);
    }
    function summarizeTransactions(transactions){
      const income=transactions.filter(t=>t.kind==='income').reduce((a,t)=>a+number(t.amount),0);
      const expense=transactions.filter(t=>t.kind==='expense').reduce((a,t)=>a+number(t.amount),0);
      return {income,expense,balance:income-expense,count:transactions.length};
    }
    function monthSummary(month){
      return summarizeTransactions(state.transactions.filter(t=>transactionAccountingMonth(t)===month));
    }
    function cashflowMonthSummary(month){
      return summarizeTransactions(state.transactions.filter(t=>String(t.date||'').startsWith(month)));
    }
    function estimatedPayrollForMonth(month){
      const alreadyRecorded=state.transactions.some(t=>t.source==='payroll'&&transactionAccountingMonth(t)===month&&number(t.amount)>0);
      if(alreadyRecorded) return 0;
      const records=state.payrolls.filter(p=>payrollAccountAmount(p)>0 && String(p.month||'')<month).sort((a,b)=>String(b.month).localeCompare(String(a.month))).slice(0,3);
      if(!records.length) return 0;
      return records.reduce((sum,p)=>sum+payrollAccountAmount(p),0)/records.length;
    }
    function projectedMonthSummary(month){
      const actual=monthSummary(month);
      const estimatedPayroll=month===monthNow()?estimatedPayrollForMonth(month):0;
      return {...actual,estimatedPayroll,projectedIncome:actual.income+estimatedPayroll,projectedBalance:actual.balance+estimatedPayroll};
    }
    function yearMonthData(year){
      return Array.from({length:12},(_,i)=>{
        const m=`${year}-${pad(i+1)}`; const s=monthSummary(m); return {month:m,label:new Date(`${m}-01`).toLocaleDateString('cs-CZ',{month:'short'}),...s};
      });
    }
    function renderFinance(){
      const month=$('#financeMonth').value || monthNow(); const year=Number($('#financeYear').value||currentYear());
      const m=monthSummary(month), cash=cashflowMonthSummary(month), projected=projectedMonthSummary(month), goal=number(state.settings.savingGoal);
      const projectionLabel=projected.estimatedPayroll>0?`Včetně odhadu mzdy ${fmt(projected.estimatedPayroll)}`:'Mzda za období je již zapsaná';
      $('#financeKpis').innerHTML = [
        kpi('Příjmy za období',fmt(m.income),monthLabel(month)),
        kpi('Výdaje za období',fmt(m.expense),`${m.count} transakcí`),
        kpiHtml('Bilance období',`<span class="${m.balance>=0?'money-plus':'money-minus'}">${esc(fmt(m.balance))}</span>`,goal?`Cíl úspory: ${fmt(goal)}`:'Podle mzdového období'),
        kpiHtml('Odhad měsíce',`<span class="${projected.projectedBalance>=0?'money-plus':'money-minus'}">${esc(fmt(projected.projectedBalance))}</span>`,projectionLabel),
        kpiHtml('Hotovostní tok',`<span class="${cash.balance>=0?'money-plus':'money-minus'}">${esc(fmt(cash.balance))}</span>`,'Podle skutečných dat připsání a úhrad')
      ].join('');
      renderAnnualChart('annualFinanceChart', year); renderExpenseBars(month); renderPayrollForecast(); renderTransactions(); renderPayrollList();
    }
    function renderAnnualChart(id,year){
      const data=yearMonthData(year);
      const maxIncomeExpense=Math.max(1,...data.flatMap(d=>[d.income,d.expense]));
      const maxAbsBalance=Math.max(1,...data.map(d=>Math.abs(d.balance)));
      const w=920,h=280,p=42,bar=17,gap=14;
      const chartTop=p, chartBottom=h-p;
      const barY=v=> chartBottom-(v/maxIncomeExpense)*(chartBottom-chartTop);
      const balanceZero=(chartTop+chartBottom)/2;
      const balanceY=v=> balanceZero-(v/maxAbsBalance)*((chartBottom-chartTop)/2);
      let svg=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Roční finanční graf se zápornou i kladnou bilancí"><defs><linearGradient id="gIncome" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#33d69f"/><stop offset="1" stop-color="#06b6d4"/></linearGradient><linearGradient id="gExpense" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#ff4d6d"/><stop offset="1" stop-color="#f97316"/></linearGradient><linearGradient id="gBalance" x1="0" x2="1"><stop stop-color="#8b5cf6"/><stop offset="1" stop-color="#6ee7ff"/></linearGradient></defs>`;
      for(let i=0;i<5;i++){
        const gy=chartTop+i*(chartBottom-chartTop)/4;
        svg+=`<line x1="${p}" y1="${gy}" x2="${w-p}" y2="${gy}" stroke="var(--chart-grid)"/><text x="4" y="${gy+4}" fill="var(--muted)" font-size="11">${Math.round(maxIncomeExpense*(1-i/4)).toLocaleString('cs-CZ')}</text>`;
      }
      svg+=`<line x1="${p}" y1="${balanceZero}" x2="${w-p}" y2="${balanceZero}" stroke="var(--muted-2)" stroke-dasharray="5 5"><title>Nulová osa bilance</title></line>`;
      const points=[];
      data.forEach((d,i)=>{
        const x=p+i*((w-p*2)/12)+gap;
        const ih=Math.max(2,chartBottom-barY(d.income));
        const eh=Math.max(2,chartBottom-barY(d.expense));
        svg+=`<rect x="${x}" y="${chartBottom-ih}" width="${bar}" height="${ih}" rx="6" fill="url(#gIncome)"><title>${d.label}: příjmy ${fmt(d.income)}</title></rect>`;
        svg+=`<rect x="${x+bar+3}" y="${chartBottom-eh}" width="${bar}" height="${eh}" rx="6" fill="url(#gExpense)"><title>${d.label}: výdaje ${fmt(d.expense)}</title></rect>`;
        const bx=x+bar;
        const by=balanceY(d.balance);
        points.push(`${bx},${by}`);
        svg+=`<text x="${x+bar}" y="${h-10}" text-anchor="middle" fill="var(--muted)" font-size="11">${d.label}</text>`;
      });
      svg+=`<polyline points="${points.join(' ')}" fill="none" stroke="url(#gBalance)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
      data.forEach((d,i)=>{const [x,yv]=points[i].split(','); svg+=`<circle cx="${x}" cy="${yv}" r="4" fill="${d.balance>=0?'#ffffff':'#111827'}" stroke="#8b5cf6" stroke-width="3"><title>${d.label}: bilance ${fmt(d.balance)}</title></circle>`;});
      svg+=`<g transform="translate(${w-318},18)"><rect width="298" height="28" rx="14" fill="rgba(255,255,255,.07)"/><circle cx="18" cy="14" r="5" fill="#33d69f"/><text x="30" y="18" fill="var(--muted)" font-size="12">příjmy</text><circle cx="92" cy="14" r="5" fill="#ff4d6d"/><text x="104" y="18" fill="var(--muted)" font-size="12">výdaje</text><circle cx="174" cy="14" r="5" fill="#8b5cf6"/><text x="186" y="18" fill="var(--muted)" font-size="12">bilance +/−</text></g></svg>`;
      $('#'+id).innerHTML=svg;
    }
    function renderExpenseBars(month){
      const exp=state.transactions.filter(t=>t.kind==='expense'&&transactionAccountingMonth(t)===month); const groups={}; exp.forEach(t=>groups[t.category||'bez kategorie']=(groups[t.category||'bez kategorie']||0)+number(t.amount));
      const arr=Object.entries(groups).sort((a,b)=>b[1]-a[1]); const max=Math.max(1,...arr.map(x=>x[1]));
      $('#expenseBars').innerHTML=arr.map(([k,v])=>barRow(k,fmt(v),Math.round(v/max*100))).join('') || empty('Ve vybraném měsíci zatím nejsou výdaje.');
    }
    function clampPercent(pct,min=3){ return Math.max(min, Math.min(100, Math.round(Number(pct)||0))); }
    function barRow(label,value,pct){const val=clampPercent(pct); return `<div class="bar-row"><div class="bar-row-head"><span>${esc(label)}</span><span>${esc(value)}</span></div><progress class="bar-progress" max="100" value="${val}" aria-label="${attr(label)}: ${val} %">${val}%</progress></div>`;}
    function payrollCleanAmount(payroll){
      const fields=payroll?.fields||{};
      return number(fields.cleanPay||fields.netPay||fields.grossPay);
    }
    function payrollAccountAmount(payroll){
      const fields=payroll?.fields||{};
      return number(fields.netPay||fields.cleanPay||fields.grossPay);
    }
    function payrollVisibleNote(payroll){
      return String(payroll?.note||'').split(';').map(part=>part.trim()).filter(part=>part && !/^čistá mzda\s/i.test(part)).join('; ');
    }
    function payrollSecondaryMetric(label,value){
      return `<div class="payroll-metric"><span>${esc(label)}</span><strong>${esc(fmt(value))}</strong></div>`;
    }
    function renderPayrollForecast(){
      const records=state.payrolls.filter(p=>payrollCleanAmount(p)>0).sort((a,b)=>b.month.localeCompare(a.month));
      if(!records.length){$('#payrollForecast').innerHTML=empty('Po načtení prvních výplatních pásek se zde zobrazí odhad další čisté mzdy a průměr odvodů.');return;}
      const avg = arr => arr.reduce((a,b)=>a+b,0)/Math.max(1,arr.length);
      const last3=records.slice(0,3), last6=records.slice(0,6);
      const avg3=avg(last3.map(payrollCleanAmount)), avg6=avg(last6.map(payrollCleanAmount));
      const tax=avg(records.slice(0,6).map(p=>number(p.fields.incomeTax))); const soc=avg(records.slice(0,6).map(p=>number(p.fields.socialInsurance))); const health=avg(records.slice(0,6).map(p=>number(p.fields.healthInsurance)));
      $('#payrollForecast').innerHTML=`<div class="kpis kpis-two compact-kpis"><div class="kpi"><div class="label">Odhad příští čisté mzdy</div><div class="value">${fmt(avg3||avg6)}</div><div class="sub">Průměr posledních ${last3.length} pásek</div></div><div class="kpi"><div class="label">Roční odhad čistého příjmu</div><div class="value">${fmt((avg6||avg3)*12)}</div><div class="sub">Podle průměru posledních ${last6.length} pásek</div></div></div><div class="spacer-12"></div><div class="bar-list">${barRow('Průměrná záloha na daň',fmt(tax),Math.min(100,tax/Math.max(1,avg6)*100))}${barRow('Průměrné sociální pojištění',fmt(soc),Math.min(100,soc/Math.max(1,avg6)*100))}${barRow('Průměrné zdravotní pojištění',fmt(health),Math.min(100,health/Math.max(1,avg6)*100))}</div>`;
    }
    function saveTransaction(e){
      e.preventDefault();
      const id=$('#transId').value||uid('trans');
      const existing=state.transactions.find(t=>t.id===id);
      const transaction=buildTransactionRecord({id,date:$('#transDate').value,kind:$('#transKind').value,category:$('#transCategory').value.trim(),amount:$('#transAmount').value,description:$('#transDescription').value.trim()}, existing);
      if(!(number(transaction.amount)>0)){ toast('Částka transakce musí být vyšší než nula.','bad'); return; }
      transaction.shared = transaction.source==='payroll' ? false : !!$('#transShared')?.checked;
      if(existing) Object.assign(existing,transaction); else state.transactions.unshift(transaction);
      save(); resetTransactionForm(); toast('Transakce uložena.');
    }
    function resetTransactionForm(){ $('#transactionForm').reset(); $('#transId').value=''; $('#transDate').value=today(); if($('#transShared')) $('#transShared').checked=true; }
    function editTransactionForm(id){const t=state.transactions.find(x=>x.id===id); if(!t)return; showTab('finance'); toggleAddCard('transAddCard',true); $('#transId').value=t.id; $('#transDate').value=t.date; $('#transKind').value=t.kind; $('#transCategory').value=t.category; $('#transAmount').value=t.amount; $('#transDescription').value=t.description||''; if($('#transShared')) $('#transShared').checked=t.shared!==false && t.source!=='payroll';}
    function renderTransactions(){
      const q=strip($('#transSearch')?.value||''), kind=$('#transKindFilter')?.value||'all', source=$('#transSourceFilter')?.value||'all', period=$('#transPeriodFilter')?.value||'selected';
      const month=$('#financeMonth').value, year=$('#financeYear').value;
      let arr=state.transactions.filter(t=>{
        const accountingMonth=transactionAccountingMonth(t);
        const inPeriod = period==='all' ? true : period==='year' ? accountingMonth.startsWith(year+'-') : accountingMonth===month;
        return inPeriod && (kind==='all'||t.kind===kind) && (source==='all'||t.source===source) && (!q || strip([t.category,t.description,t.amount,t.date,t.payrollMonth].join(' ')).includes(q));
      }).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
      $('#transactionsList').innerHTML=arr.map(t=>{
        const sourceInfo=t.source==='payroll'
          ? `mzdové období ${monthLabel(t.payrollMonth||String(t.date).slice(0,7))} • připsáno ${t.date}`
          : t.source==='payment'
            ? `uhrazeno ${t.date} • z Účtů a závazků`
            : t.source==='installment'
              ? `uhrazeno ${t.date} • ze Splátkového kalendáře`
              : `${t.date} • ruční záznam`;
        const actions=t.source==='payment'&&t.paymentId
          ? `<button class="mini-btn" data-edit-payment="${attr(t.paymentId)}" type="button">Otevřít závazek</button><button class="mini-btn" data-delete-trans="${attr(t.id)}" type="button">Odpojit výdaj</button>`
          : t.source==='installment'&&t.installmentId
            ? `<button class="mini-btn" data-edit-inst="${attr(t.installmentId)}" type="button">Otevřít splátku</button><button class="mini-btn" data-delete-trans="${attr(t.id)}" type="button">Odpojit výdaj</button>`
            : `<button class="mini-btn" data-edit-trans="${attr(t.id)}" type="button">Upravit</button><button class="mini-btn" data-delete-trans="${attr(t.id)}" type="button">Smazat</button>`;
        const linkedClass=['payment','installment'].includes(t.source)?'payment-finance-linked':'';
        return `<article class="item ${linkedClass}"><div class="item-top"><div><h4>${t.kind==='income'?'Příjem':'Výdaj'} • ${esc(t.category)}</h4><p>${esc(sourceInfo)} • <strong class="${t.kind==='income'?'money-plus':'money-minus'}">${fmt(t.amount)}</strong></p>${t.description?`<p>${esc(t.description)}</p>`:''}<div class="meta">${t.source==='payment'?'<span class="tag">🔗 propojeno s platbou</span>':''}${t.source==='installment'?'<span class="tag">🔗 propojeno se splátkou</span>':''}${t.source==='payroll'?'<span class="tag">📄 výplatní páska</span>':''}</div></div><div class="actions">${actions}</div></div></article>`;
      }).join('') || empty('Žádné transakce pro aktuální filtr.');
    }
    function renderPayrollList(){
      $('#payrollList').innerHTML=state.payrolls.map(p=>{
        const clean=payrollCleanAmount(p);
        const account=payrollAccountAmount(p);
        const gross=number(p.fields?.grossPay);
        const tax=number(p.fields?.incomeTax);
        const note=payrollVisibleNote(p);
        const metrics=[
          account!==clean ? payrollSecondaryMetric('Na účet',account) : '',
          gross>0 ? payrollSecondaryMetric('Hrubá mzda',gross) : '',
          tax>=0 ? payrollSecondaryMetric('Daň',tax) : ''
        ].filter(Boolean).join('');
        return `<article class="item payroll-card">
          <div class="payroll-card-head">
            <div><p class="payroll-period">${esc(monthLabel(p.month))}</p>${p.employer?`<h4>${esc(p.employer)}</h4>`:''}</div>
            <span class="status ${p.storedPdf?'good':'warn'}">${p.storedPdf?'PDF bezpečně uloženo':'Bez PDF kopie'}</span>
          </div>
          <div class="payroll-primary"><span>Čistá mzda</span><strong>${esc(fmt(clean))}</strong></div>
          <p class="small">Mzdové období: <strong>${esc(monthLabel(p.month))}</strong> • připsáno na účet: <strong>${esc(p.paymentDate?fmtDate(`${p.paymentDate}T00:00:00`):'neuvedeno')}</strong>${p.paymentDateEstimated?' (odhad data)':''}</p>
          <div class="payroll-metrics">${metrics}</div>
          ${note?`<p class="payroll-note">${esc(note)}</p>`:''}
          <details class="payroll-file-details"><summary>Soubor a technické údaje</summary><div class="meta"><span class="tag payroll-file-name" title="${attr(p.fileName||'bez názvu PDF')}">${esc(p.fileName||'bez názvu PDF')}</span></div></details>
          <div class="actions payroll-actions">${p.storedPdf?`<button class="mini-btn payroll-download" data-download-payroll="${attr(p.id)}" type="button">Stáhnout PDF</button><button class="mini-btn" data-purge-payroll-pdf="${attr(p.id)}" type="button">Smazat jen PDF</button>`:''}<button class="mini-btn payroll-delete" data-delete-payroll="${attr(p.id)}" type="button">Smazat záznam</button></div>
        </article>`;
      }).join('') || empty('Zatím nejsou uložené výplatní pásky.');
    }
    async function deletePayroll(id){
      if(!await confirmDialog('Smazat výplatní pásku včetně navázaného mzdového příjmu?', {title:'Smazat výplatní pásku', confirmText:'Smazat', danger:true})) return;
      const p = state.payrolls.find(x=>x.id===id);
      if(p?.storedPdf){
        try{ await idbDelete(id); }
        catch(err){ console.error(err); toast('Lokální PDF se nepodařilo smazat, metadata proto zůstala beze změny.','bad'); return; }
      }
      state.payrolls=state.payrolls.filter(p=>p.id!==id); state.transactions=state.transactions.filter(t=>t.payrollId!==id); save(); toast('Výplatní páska smazána.','warn');
    }
    async function downloadPayrollPdf(id){
      try{const file=await idbGet(id); if(!file){toast('PDF v lokálním úložišti nenalezeno.','bad');return;} download(file.name||`vyplatni-paska-${id}.pdf`, file, file.type||'application/pdf');}
      catch(e){toast('PDF se nepodařilo stáhnout.','bad');}
    }
    async function purgePayrollPdf(id){
      if(!await confirmDialog('Smazat jen uložené PDF a ponechat vyčtené částky i transakci?', {title:'Smazat PDF kopii', confirmText:'Smazat PDF', danger:true})) return;
      try{await idbDelete(id);}
      catch(err){ console.error(err); toast('PDF se nepodařilo smazat, metadata zůstala beze změny.','bad'); return; }
      const p=state.payrolls.find(x=>x.id===id); if(p){p.storedPdf=false; p.updatedAt=new Date().toISOString();}
      save(); toast('Lokální PDF bylo smazáno, částky zůstaly zachovány.','warn');
    }
    async function idbPut(id,file,store=PDF_STORE){
      if(!appReady || !vaultKey) throw new Error('Trezor není odemčený; soubor nelze uložit.');
      if(!file) throw new Error('Chybí soubor pro uložení.');
      const value = await encryptBlobForIdb(file);
      await idbRawPut(id,value,store);
    }
    async function idbGet(id,store=PDF_STORE){
      const value = await idbRawGet(id,store);
      if(value && value.kind === 'LifeHub encrypted blob') return decryptBlobFromIdb(value);
      return value;
    }
    async function idbHasRecord(id, store=PDF_STORE){
      if(!id) return false;
      try{ return !!(await idbRawGet(id, store)); }
      catch(error){ console.warn(error); return false; }
    }
    async function reconcileStoredFileFlags(){
      let changed = 0;
      const [payrollKeys, vaultKeys] = await Promise.all([idbGetKeys(PDF_STORE), idbGetKeys(VAULT_STORE)]);
      const payrollSet = new Set(payrollKeys.map(String));
      const vaultSet = new Set(vaultKeys.map(String));
      for(const p of state.payrolls){
        const exists = payrollSet.has(String(p.id));
        if(!!p.storedPdf !== exists){ p.storedPdf = exists; changed++; }
      }
      for(const d of state.documents){
        const exists = vaultSet.has(String(d.id));
        if((d.storedFile !== false) !== exists){ d.storedFile = exists; changed++; }
      }
      if(changed){
        state.updatedAt = new Date().toISOString();
        await persistEncryptedState();
        console.info(`LifeHub file flags reconciled: ${changed} metadata flags updated from IndexedDB.`);
      }
      return changed;
    }
    function resetVaultForm(){ $('#vaultId').value=''; $('#vaultTitle').value=''; $('#vaultCategory').value='jine'; $('#vaultDate').value=today(); $('#vaultFile').value=''; $('#vaultNote').value=''; }
    async function assertStorageHeadroom(bytes){
      if(!navigator.storage?.estimate) return;
      const estimate = await navigator.storage.estimate();
      const available = Math.max(0, Number(estimate.quota||0) - Number(estimate.usage||0));
      if(available && bytes * 1.25 > available) throw new Error(`V zařízení není dost volného prostoru. Dostupné přibližně ${formatBytes(available)}.`);
    }
    async function saveVaultDoc(e){
      e.preventDefault();
      const id = $('#vaultId').value || uid('doc');
      const file = $('#vaultFile').files[0];
      if(file && file.size > MAX_COMPLETE_BACKUP_FILE_BYTES){ toast(`Soubor je příliš velký. Maximální velikost je ${formatBytes(MAX_COMPLETE_BACKUP_FILE_BYTES)}, aby šel bezpečně zálohovat.`, 'bad'); return; }
      const existing = state.documents.find(d=>d.id===id);
      if(!file && !existing){ toast('Vyberte soubor, který se má uložit do šifrovaného trezoru.','warn'); return; }
      const meta = {
        id,
        title: $('#vaultTitle').value.trim() || file?.name || existing?.title || 'Dokument',
        category: $('#vaultCategory').value,
        date: $('#vaultDate').value || today(),
        note: $('#vaultNote').value.trim(),
        fileName: file?.name || existing?.fileName || '',
        mime: file?.type || existing?.mime || 'application/octet-stream',
        size: file?.size || existing?.size || 0,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        storedFile: true,
        encrypted: !!vaultKey
      };
      try{
        if(file){ await assertStorageHeadroom(file.size); await idbPut(id, file, VAULT_STORE); }
        state.documents = [meta, ...state.documents.filter(d=>d.id!==id)];
        save(); resetVaultForm(); toast('Dokument uložen v šifrovaném trezoru.');
      }catch(err){ console.error(err); toast('Soubor se nepodařilo uložit do šifrovaného trezoru.','bad'); }
    }
    function vaultDocStored(d){ return d?.storedFile !== false; }
    function renderVault(){
      populateVaultFilters();
      renderVaultCapacity();
      const q=strip($('#vaultSearch')?.value||''), cat=$('#vaultCategoryFilter')?.value||'all', sort=$('#vaultSort')?.value||'new';
      let arr=state.documents.filter(d=>(cat==='all'||d.category===cat)&&(!q||strip([d.title,d.category,d.note,d.fileName].join(' ')).includes(q)));
      arr.sort((a,b)=> sort==='title'?String(a.title).localeCompare(String(b.title),'cs'):sort==='category'?String(a.category).localeCompare(String(b.category),'cs'):new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt));
      $('#vaultList').innerHTML=arr.map(d=>{
        const stored = vaultDocStored(d);
        return `<article class="item"><div class="item-top"><div><h4>${esc(d.title)}</h4><p><strong>${esc(docCategoryLabel(d.category))}</strong> • ${esc(d.date||'bez data')} • ${esc(d.fileName||'bez názvu souboru')} • ${formatBytes(d.size)}</p>${d.note?`<p>${esc(d.note)}</p>`:''}<div class="meta">${stored?'<span class="status good">soubor uložen lokálně</span>':'<span class="status warn">jen metadata, soubor chybí</span>'}<span class="tag">${esc(d.mime||'soubor')}</span></div></div><div class="actions">${stored?`<button class="mini-btn" data-download-doc="${attr(d.id)}" type="button">Stáhnout</button>`:''}<button class="mini-btn" data-delete-doc="${attr(d.id)}" type="button">Smazat</button></div></div></article>`;
      }).join('') || empty('Archiv je zatím prázdný.');
    }
    function populateVaultFilters(){ if(!$('#vaultCategoryFilter')) return; fillSelect($('#vaultCategoryFilter'),'Všechny typy',[...new Set(state.documents.map(d=>d.category).filter(Boolean))].map(docCategoryLabel), [...new Set(state.documents.map(d=>d.category).filter(Boolean))]); }
    function docCategoryLabel(c){return {'vyplatni-paska':'Výplatní páska','finance':'Finance','skola':'Škola/práce','smlouva':'Smlouva','faktura':'Faktura','export':'Export / AI výstup','nakup':'Nákupní seznam','jine':'Jiné'}[c] || c || 'Jiné';}
    function formatBytes(bytes){ const n=Number(bytes)||0; if(n<1024) return `${n} B`; if(n<1024*1024) return `${(n/1024).toFixed(1)} kB`; return `${(n/1024/1024).toFixed(1)} MB`; }
    async function downloadVaultDoc(id){ try{const file=await idbGet(id, VAULT_STORE); const meta=state.documents.find(d=>d.id===id); if(!file){toast('Soubor v lokálním úložišti nenalezen.','bad');return;} download(meta?.fileName || file.name || `dokument-${id}`, file, file.type||meta?.mime||'application/octet-stream');}catch(e){toast('Soubor se nepodařilo stáhnout.','bad');} }
    async function deleteVaultDoc(id){
      if(!await confirmDialog('Opravdu smazat dokument z šifrovaného trezoru?', {title:'Smazat dokument', confirmText:'Smazat', danger:true})) return;
      try{await idbDelete(id, VAULT_STORE);}
      catch(err){ console.error(err); toast('Soubor se nepodařilo smazat z IndexedDB, metadata zůstala beze změny.','bad'); return; }
      state.documents=state.documents.filter(d=>d.id!==id); save(); toast('Dokument smazán z archivu.','warn');
    }
    async function renderVaultCapacity(){
      const box = $('#vaultCapacity'); if(!box) return;
      const docCount = state.documents.length;
      const pdfCount = state.payrolls.filter(p=>p.storedPdf).length;
      if(!navigator.storage?.estimate){
        box.innerHTML = `<p class="capacity-note">Prohlížeč nehlásí odhad kapacity. V trezoru je ${docCount} dokumentů a ${pdfCount} PDF pásek. Kapacitu určuje volné místo prohlížeče (obvykle stovky MB až jednotky GB).</p>`;
        return;
      }
      try{
        const est = await navigator.storage.estimate();
        const usage = est.usage||0, quota = est.quota||0;
        const pct = quota ? Math.round(usage/quota*100) : 0;
        let persisted = null;
        try{ persisted = await navigator.storage.persisted?.(); }catch(e){}
        box.innerHTML = barRow(`Využito ${formatBytes(usage)} z ${formatBytes(quota)}`, `${pct}%`, pct)
          + `<p class="capacity-note">V šifrovaném trezoru je ${docCount} dokumentů a ${pdfCount} uložených PDF pásek. Kapacita = volné místo tohoto prohlížeče na tomto zařízení; sdílí se s ostatními daty stránky.${persisted===false?' Úložiště zatím není označené jako trvalé – zvaž tlačítko „Požádat o trvalé úložiště“.':persisted===true?' Úložiště je označené jako trvalé.':''}</p>`;
      }catch(e){
        box.innerHTML = `<p class="capacity-note">Odhad kapacity se nepodařilo načíst. V trezoru je ${docCount} dokumentů a ${pdfCount} PDF pásek.</p>`;
      }
    }
    async function requestPersistentStorage(){
      if(!navigator.storage?.persist){ toast('Tento prohlížeč neumí ručně požádat o trvalé úložiště.','warn'); return; }
      try{ const granted = await navigator.storage.persist(); toast(granted ? 'Prohlížeč povolil trvalejší lokální úložiště.' : 'Prohlížeč trvalejší úložiště nepotvrdil. Zálohy dál stahujte ručně.', granted?'good':'warn'); }
      catch(e){ toast('Žádost o trvalé úložiště selhala.','warn'); }
    }

    function saveTask(e){e.preventDefault(); const id=$('#taskId').value||uid('task'); const existing=state.tasks.find(t=>t.id===id); const t={id,title:$('#taskTitle').value.trim(),priority:$('#taskPriority').value,horizon:$('#taskHorizon').value,due:$('#taskDue').value,area:$('#taskArea').value.trim(),note:$('#taskNote').value.trim(),assignedTo:['me','partner','both'].includes($('#taskAssignedTo')?.value)?$('#taskAssignedTo').value:'both',shared:!!$('#taskShared')?.checked,done:existing?.done||false,createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()}; if(existing)Object.assign(existing,t); else state.tasks.unshift(t); save(); resetTaskForm(); toast('Úkol uložen.');}
    function resetTaskForm(){ $('#taskForm').reset(); $('#taskId').value=''; $('#taskPriority').value='normal'; $('#taskHorizon').value='month'; if($('#taskShared')) $('#taskShared').checked=true; if($('#taskAssignedTo')) $('#taskAssignedTo').value='both'; }
    function editTaskForm(id){const t=state.tasks.find(x=>x.id===id); if(!t)return; showTab('tasks'); toggleAddCard('taskAddCard',true); $('#taskId').value=t.id; $('#taskTitle').value=t.title; $('#taskPriority').value=t.priority||'normal'; $('#taskHorizon').value=t.horizon||'month'; $('#taskDue').value=t.due||''; $('#taskArea').value=t.area||''; $('#taskNote').value=t.note||''; if($('#taskAssignedTo')) $('#taskAssignedTo').value=t.assignedTo||'both'; if($('#taskShared')) $('#taskShared').checked=t.shared!==false;}
    function toggleTaskDone(id){const t=state.tasks.find(x=>x.id===id); if(t){t.done=!t.done;t.updatedAt=new Date().toISOString();save();}}
    function renderTasks(){
      populateTaskFilters();
      const q=strip($('#taskSearch')?.value||''), status=$('#taskStatusFilter')?.value||'open', area=$('#taskAreaFilter')?.value||'all', sort=$('#taskSort')?.value||'priority';
      const matches=t=>(area==='all'||t.area===area)&&(!q||strip([t.title,t.note,t.area].join(' ')).includes(q));
      const prRank={high:0,normal:1,low:2};
      const sortFn=(a,b)=> sort==='due'?String(a.due||'9999').localeCompare(String(b.due||'9999')) : sort==='new'?new Date(b.createdAt)-new Date(a.createdAt) : (prRank[a.priority]??1)-(prRank[b.priority]??1);
      let arr=state.tasks.filter(t=>(status==='all'||(status==='done'?t.done:!t.done))&&matches(t));
      const completed=state.tasks.filter(t=>t.done&&matches(t)).sort(sortFn);
      const completedArchive=$('#taskCompletedArchive');
      const showArchive=status==='open'&&!q&&completed.length>0;
      if(completedArchive) completedArchive.hidden=!showArchive;
      const completedCount=$('#taskCompletedCount'); if(completedCount) completedCount.textContent=String(completed.length);
      const completedList=$('#taskCompletedList'); if(completedList) completedList.innerHTML=completed.map(taskCard).join('')||empty('Archiv dokončených úkolů je prázdný.');
      const board=$('#taskBoard');
      if(q || status!=='open'){
        const items=[...arr].sort(sortFn);
        board.classList.add('task-flat');
        board.innerHTML = items.map(taskCard).join('') || empty(q?'Nic neodpovídá hledání.':'Žádné úkoly pro aktuální filtr.');
        return;
      }
      board.classList.remove('task-flat');
      const lanes=[['week','🗓️ Tento týden'],['month','📅 Tento měsíc'],['long','🌱 Dlouhodobé']];
      board.innerHTML=lanes.map(([key,label])=>{let items=arr.filter(t=>(t.horizon||'month')===key); items.sort(sortFn); return `<div class="lane"><h3>${label}<span class="tag">${items.length}</span></h3>${items.map(taskCard).join('')||'<div class="empty">Prázdné</div>'}</div>`}).join('');
    }
    function taskCard(t){const prClass=t.priority==='high'?'high':t.priority==='low'?'low':'mid';return `<article class="task ${t.done?'done':''}"><div class="checkline"><input type="checkbox" data-toggle-task="${attr(t.id)}" ${t.done?'checked':''}><div><h4>${esc(t.title)}</h4><p>${esc(t.area||'bez oblasti')}${t.due?' • termín '+esc(t.due):''}</p>${t.note?`<p>${esc(t.note)}</p>`:''}<div class="meta"><span class="priority ${prClass}">${taskPriorityLabel(t.priority)}</span><span class="task-horizon-pill">${taskHorizonLabel(t.horizon)}</span></div></div></div><div class="actions"><button class="mini-btn" data-edit-task="${attr(t.id)}" type="button">Upravit</button><button class="mini-btn" data-delete-task="${attr(t.id)}" type="button">Smazat</button></div></article>`;}
    function populateTaskFilters(){fillSelect($('#taskAreaFilter'),'Všechny oblasti',[...new Set(state.tasks.map(t=>t.area).filter(Boolean))]);}
    function taskPriorityLabel(p){return p==='high'?'🔴 Vysoká':p==='low'?'🟢 Nízká':'🟡 Střední';}
    function taskHorizonLabel(h){return h==='week'?'Tento týden':h==='long'?'Dlouhodobé':'Tento měsíc';}

    function saveShopping(e){e.preventDefault(); const id=$('#shopId').value||uid('shop'); const existing=state.shopping.find(s=>s.id===id); const s={id,name:$('#shopName').value.trim(),segment:'general',store:$('#shopStore').value,priority:$('#shopPriority').value,status:$('#shopStatus').value,category:$('#shopCategory').value.trim(),price:number($('#shopPrice').value),month:$('#shopMonth').value,url:safeUrl($('#shopUrl').value),note:$('#shopNote').value.trim(),shared:!!$('#shopShared')?.checked,createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()}; if(existing)Object.assign(existing,s); else state.shopping.unshift(s); save(); resetShoppingForm(); toast('Velký nákup uložen.');}
    function resetShoppingForm(){ $('#shoppingForm').reset(); $('#shopId').value=''; $('#shopMonth').value=monthNow(); if($('#shopShared')) $('#shopShared').checked=true; }
    function editShoppingForm(id){const s=state.shopping.find(x=>x.id===id); if(!s)return; showTab('shopping'); toggleAddCard('shopAddCard',true); $('#shopId').value=s.id; $('#shopName').value=s.name; $('#shopStore').value=s.store||''; $('#shopPriority').value=s.priority; $('#shopStatus').value=s.status; $('#shopCategory').value=s.category||''; $('#shopPrice').value=s.price||''; $('#shopMonth').value=s.month||''; $('#shopUrl').value=s.url||''; $('#shopNote').value=s.note||''; if($('#shopShared')) $('#shopShared').checked=s.shared!==false;}
    function renderShopping(){
      const year=Number($('#shoppingYear')?.value||currentYear());
      const active=state.shopping.filter(s=>s.status!=='bought');
      const urgent=active.filter(s=>s.priority==='urgent').reduce((a,s)=>a+number(s.price),0);
      const yearTotal=active.filter(s=>s.month?.startsWith(year+'-')).reduce((a,s)=>a+number(s.price),0);
      const bought=state.shopping.filter(s=>s.status==='bought').length;
      $('#shoppingKpis').innerHTML=[kpi('Aktivní plány',active.length,'Velké nákupy k pořízení'),kpi('Urgentní',fmt(urgent),'Součet cen urgentních'),kpi('Roční plán',fmt(yearTotal),String(year)),kpi('Koupeno',bought,'Dokončené nákupy')].join('');
      renderShoppingChart(year); renderShoppingList();
    }
    function renderShoppingChart(year){
      // Dřívější SVG graf ukazoval jen sloupce odhadovaných cen plánovaných nákupů po
      // měsících – bez cen a s položkami v jednom měsíci nic neříkal. Tento přehled
      // ukazuje po měsících plán i skutečně koupené a upozorní na chybějící ceny.
      const el=$('#shoppingChart'); if(!el) return;
      const inYear=state.shopping.filter(x=>String(x.month||'').startsWith(year+'-'));
      const noMonth=state.shopping.filter(x=>!x.month && x.status!=='bought');
      const byMonth={};
      inYear.forEach(x=>{ (byMonth[x.month]??={planned:0,bought:0,count:0}); byMonth[x.month].count++; if(x.status==='bought') byMonth[x.month].bought+=number(x.price); else byMonth[x.month].planned+=number(x.price); });
      const months=Object.keys(byMonth).sort();
      const maxVal=Math.max(1,...months.map(m=>byMonth[m].planned+byMonth[m].bought));
      let html=months.map(m=>{
        const d=byMonth[m];
        const label=`${d.planned?`plán ${fmt(d.planned)}`:''}${d.planned&&d.bought?' • ':''}${d.bought?`koupeno ${fmt(d.bought)}`:''}${!d.planned&&!d.bought?'bez odhadu ceny':''} • ${d.count} pol.`;
        return barRow(monthLabel(m), label, (d.planned+d.bought)/maxVal*100);
      }).join('');
      if(noMonth.length){
        const sum=noMonth.reduce((a,x)=>a+number(x.price),0);
        html+=barRow('Bez plánovaného měsíce', `plán ${fmt(sum)} • ${noMonth.length} pol.`, 0);
      }
      const noPrice=state.shopping.filter(x=>x.status!=='bought' && !number(x.price)).length;
      if(noPrice) html+=`<p class="small">💡 U ${noPrice} aktivních položek chybí odhad ceny – po doplnění bude roční plán vypovídající.</p>`;
      el.innerHTML=html||empty(`Pro rok ${year} zatím nejsou žádné velké nákupy. Přidejte položku s plánovaným měsícem a odhadem ceny.`);
    }
    function renderShoppingList(){
      const q=strip($('#shopSearch')?.value||''), pri=$('#shopPriorityFilter')?.value||'all', stat=$('#shopStatusFilter')?.value||'open', sort=$('#shopSort')?.value||'priority';
      const order={urgent:0,soon:1,later:2};
      const matches=s=>(pri==='all'||s.priority===pri)&&(!q||strip([s.name,s.note,s.category,s.store].join(' ')).includes(q));
      const sortFn=(a,b)=> sort==='priority'?(order[a.priority]??9)-(order[b.priority]??9): sort==='month'?String(a.month||'9999').localeCompare(String(b.month||'9999')): sort==='price'?number(b.price)-number(a.price):new Date(b.createdAt)-new Date(a.createdAt);
      const statusMatch=s=>stat==='all'||(stat==='open'?s.status==='planned':s.status===stat);
      const arr=state.shopping.filter(s=>statusMatch(s)&&matches(s)).sort(sortFn);
      const list=$('#shoppingList'); if(list) list.innerHTML=arr.map(s=>shoppingCard(s)).join('') || empty('Žádné velké nákupy pro aktuální filtr.');

      const useArchives=stat==='open'&&!q;
      const paused=state.shopping.filter(s=>s.status==='paused'&&matches(s)).sort(sortFn);
      const bought=state.shopping.filter(s=>s.status==='bought'&&matches(s)).sort((a,b)=>String(b.updatedAt||b.createdAt).localeCompare(String(a.updatedAt||a.createdAt)));
      const pausedArchive=$('#shoppingPausedArchive'); if(pausedArchive) pausedArchive.hidden=!(useArchives&&paused.length);
      const pausedCount=$('#shoppingPausedCount'); if(pausedCount) pausedCount.textContent=String(paused.length);
      const pausedList=$('#shoppingPausedList'); if(pausedList) pausedList.innerHTML=paused.map(s=>shoppingCard(s,true)).join('')||empty('Žádné odložené položky.');
      const boughtArchive=$('#shoppingBoughtArchive'); if(boughtArchive) boughtArchive.hidden=!(useArchives&&bought.length);
      const boughtCount=$('#shoppingBoughtCount'); if(boughtCount) boughtCount.textContent=String(bought.length);
      const boughtList=$('#shoppingBoughtList'); if(boughtList) boughtList.innerHTML=bought.map(s=>shoppingCard(s,true)).join('')||empty('Žádné koupené položky.');
    }
    function shoppingCard(s,archived=false){
      const restore=archived?`<button class="mini-btn" data-shop-id="${attr(s.id)}" data-shop-status="planned" type="button">Vrátit do plánu</button>`:'';
      return `<article class="item ${archived?'archive-item':''}"><div class="item-top"><div><h4>${esc(s.name)}</h4><p><strong>${fmt(s.price)}</strong> • ${shopPriorityLabel(s.priority)} • ${esc(s.month?monthLabel(s.month):'bez měsíce')}</p>${s.note?`<p>${esc(s.note)}</p>`:''}<div class="meta">${s.store?`<span class="tag">🏬 ${esc(s.store)}</span>`:''}<span class="priority ${s.priority==='urgent'?'high':s.priority==='soon'?'mid':'low'}">${shopPriorityLabel(s.priority)}</span><span class="tag">${shopStatusLabel(s.status)}</span>${s.category?`<span class="tag">${esc(s.category)}</span>`:''}${s.url?`<a class="tag" href="${attr(safeUrl(s.url))}" target="_blank" rel="noopener">odkaz ↗</a>`:''}</div></div><div class="actions">${restore}<button class="mini-btn" data-edit-shop="${attr(s.id)}" type="button">Upravit</button><button class="mini-btn" data-delete-shop="${attr(s.id)}" type="button">Smazat</button></div></div></article>`;
    }
    function setShoppingStatus(id,status){
      const item=state.shopping.find(s=>s.id===id); if(!item||!['planned','paused','bought'].includes(status)) return;
      item.status=status; item.updatedAt=new Date().toISOString(); save();
      toast(status==='planned'?'Položka vrácena mezi aktivní plány.':status==='bought'?'Položka označena jako koupená.':'Položka odložena.');
    }
    function shopPriorityLabel(p){return p==='urgent'?'Urgentní':p==='soon'?'Brzy':'Dlouhodobé';}
    function shopStatusLabel(s){return s==='bought'?'Koupeno':s==='paused'?'Odloženo':'Plánováno';}

    function cloneStateForBackup({includeFamilyPassword=true}={}){
      const clone=JSON.parse(JSON.stringify(state));
      if(!includeFamilyPassword && clone.settings) delete clone.settings.familyPassword;
      return clone;
    }
    function currentDeviceName(){ return (state.settings.deviceName || '').trim() || 'Neoznačené zařízení'; }
    function backupMetadata(type, createdAt=new Date().toISOString()){
      return {
        exportedFrom: currentDeviceName(),
        exportedAt: createdAt,
        appVersion: VERSION,
        exportType: type
      };
    }
    function preserveLocalDeviceSettings(imported){
      if(imported?.settings){
        imported.settings.deviceName = state.settings.deviceName || '';
        imported.settings.familyPassword = state.settings.familyPassword || imported.settings.familyPassword || '';
      }
      return imported;
    }
    function buildDataBackupPayload({includeFamilyPassword=true}={}){
      const createdAt = new Date().toISOString();
      return {
        kind:'LifeHub data backup',
        version:VERSION,
        mode:'data-only',
        createdAt,
        metadata: backupMetadata('data-only', createdAt),
        note:includeFamilyPassword?'Obsahuje stav aplikace a metadata dokumentů včetně uloženého rodinného hesla. Neobsahuje PDF ani skutečné soubory z IndexedDB.':'Obsahuje stav aplikace a metadata dokumentů bez uloženého rodinného hesla. Neobsahuje PDF ani skutečné soubory z IndexedDB.',
        state:cloneStateForBackup({includeFamilyPassword})
      };
    }
    function estimateStoredFileBackup(){
      const payrolls = state.payrolls.filter(p=>p.storedPdf);
      const docs = state.documents.filter(d=>d.storedFile !== false);
      const bytes = payrolls.reduce((sum,p)=>sum+number(p.fileSize),0) + docs.reduce((sum,d)=>sum+number(d.size),0);
      return {payrollCount:payrolls.length, docCount:docs.length, fileCount:payrolls.length+docs.length, bytes};
    }
    function formatBackupTime(iso){
      if(!iso) return 'zatím nikdy';
      try{return new Date(iso).toLocaleString('cs-CZ',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});}
      catch(e){return 'neznámé datum';}
    }
    function daysSince(iso){
      const ms = Date.parse(iso || '');
      if(!Number.isFinite(ms)) return null;
      return Math.floor((Date.now() - ms) / 86400000);
    }
    function backupFreshnessText(){
      const days = daysSince(state.settings.lastCompleteBackupAt);
      if(days === null) return 'Kompletní záloha ještě nebyla vytvořena. Doporučení: vytvořit ji hned po nahrání této verze.';
      if(days < 0) return 'Datum poslední kompletní zálohy je v budoucnosti; zkontroluj hodiny zařízení.';
      if(days <= 7) return `Kompletní záloha je čerstvá (${days} dní).`;
      if(days <= 14) return `Kompletní záloha je starší (${days} dní). Při větších změnách ji obnov.`;
      return `Kompletní záloha je stará ${days} dní. Doporučení: vytvořit novou kompletní zálohu.`;
    }
    function renderBackupStatus(){
      const box = $('#backupStatus'); if(!box) return;
      const est = estimateStoredFileBackup();
      box.innerHTML = `<div class="security-list"><div class="security-item"><strong>Šifrovaná datová záloha</strong><span class="small">Poslední: ${esc(formatBackupTime(state.settings.lastDataBackupAt))}<br>Obsahuje poznámky, finance, úkoly, nákupy a metadata dokumentů. Nepřenáší PDF ani soubory.</span></div><div class="security-item"><strong>Kompletní šifrovaná záloha</strong><span class="small">Poslední: ${esc(formatBackupTime(state.settings.lastCompleteBackupAt))}<br>${esc(backupFreshnessText())}<br>Přenese i ${est.fileCount} lokálních souborů (${esc(formatBytes(est.bytes))}) z výplatních pásek a trezoru.</span></div><div class="security-item"><strong>Ověření zálohy</strong><span class="small">Poslední ověření: ${esc(formatBackupTime(state.settings.lastVerifiedBackupAt))}<br>Ověření soubor načte a případně dešifruje, ale nic nepřepíše.</span></div><div class="security-item"><strong>Poslední obnova</strong><span class="small">${esc(formatBackupTime(state.settings.lastRestoreAt))}</span></div><div class="security-item"><strong>Zařízení</strong><span class="small">Název v zálohách: ${esc(currentDeviceName())}</span></div><div class="security-item"><strong>Doporučení pro mobil ↔ PC</strong><span class="small">Pro přenos z hlavního telefonu do PC použij kompletní zálohu. Datová záloha je lehčí, ale bez souborů.</span></div></div>`;
    }
    async function exportEncryptedJson(){
      try{
        if(!window.crypto?.subtle){ toast('Šifrovaný export vyžaduje Web Crypto API a bezpečný kontext.', 'bad'); return; }
        const pass = await passwordDialog({title:'Heslo pro šifrovanou datovou zálohu', message:'Tato záloha přenese stav aplikace a metadata, ale nepřenese PDF ani soubory z trezoru. Pro přenos telefonu do PC použij raději kompletní šifrovanou zálohu.', repeat:true, minLength:MIN_PASSWORD_LENGTH, confirmText:'Vytvořit datovou zálohu'});
        if(!pass) return;
        const payload = buildDataBackupPayload();
        const encrypted = await encryptBackupObject(payload, pass);
        download(`lifehub-sifrovana-datova-zaloha-${today()}.json`, JSON.stringify(encrypted,null,2),'application/json;charset=utf-8');
        state.settings.lastDataBackupAt = new Date().toISOString();
        save(false); renderBackupStatus();
        toast('Šifrovaná datová záloha byla vytvořena. Neobsahuje PDF ani soubory z trezoru.');
      }catch(err){ console.error(err); toast('Šifrovanou datovou zálohu se nepodařilo vytvořit: '+(err.message||err), 'bad'); }
    }
    function effectiveCompleteBackupLimit(){ return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent||'') ? MOBILE_COMPLETE_BACKUP_TOTAL_BYTES : MAX_COMPLETE_BACKUP_TOTAL_BYTES; }
    async function collectBackupFiles(){
      const files = [];
      const missing = [];
      let totalBytes = 0;
      const addFile = async (item, store, role, fallbackName) => {
        try{
          const file = await idbGet(item.id, store);
          if(!file){ missing.push(`${fallbackName || item.fileName || item.title || item.id} – soubor není v IndexedDB`); return; }
          const record = await fileToBackupRecord({id:item.id, store, role}, file);
          totalBytes += Number(record.size) || 0;
          const limit = effectiveCompleteBackupLimit();
          if(totalBytes > limit) throw new Error(`Kompletní záloha překročila bezpečný limit tohoto zařízení ${formatBytes(limit)}.`);
          files.push(record);
        }catch(error){
          if(String(error.message||'').includes('překročila')) throw error;
          console.warn(error);
          missing.push(`${fallbackName || item.fileName || item.title || item.id} – ${error.message || 'soubor se nepodařilo přečíst'}`);
        }
      };
      for(const p of state.payrolls.filter(p=>p.storedPdf)) await addFile(p, PDF_STORE, 'payrollPdf', p.fileName || `Výplatní páska ${p.month}`);
      for(const d of state.documents.filter(d=>d.storedFile !== false)) await addFile(d, VAULT_STORE, 'vaultFile', d.fileName || d.title);
      return {files, missing, totalBytes};
    }
    async function exportCompleteEncryptedBackup(){
      try{
        if(!window.crypto?.subtle){ toast('Kompletní záloha vyžaduje Web Crypto API a bezpečný kontext.', 'bad'); return false; }
        if(!appReady || !vaultKey){ toast('Nejdřív odemkni trezor.', 'warn'); return false; }
        const estimate = estimateStoredFileBackup();
        if(estimate.fileCount > MAX_COMPLETE_BACKUP_FILES){ toast(`V trezoru je příliš mnoho souborů pro jeden balíček (${estimate.fileCount}).`, 'bad'); return false; }
        const ok = await confirmDialog(`Kompletní šifrovaná záloha je určena hlavně pro přenos telefon ↔ PC. Přenese stav aplikace i skutečné soubory z IndexedDB.\n\nOdhad: ${estimate.fileCount} souborů, přibližně ${formatBytes(estimate.bytes)} před šifrováním. Soubor může být větší a na mobilu může export/import chvíli trvat.\n\nPokračovat?`, {title:'Kompletní šifrovaná záloha', confirmText:'Pokračovat'});
        if(!ok) return false;
        const pass = await passwordDialog({title:'Heslo pro kompletní zálohu', message:'Zadejte silné heslo pro kompletní zálohu včetně PDF a dokumentů. Bez něj nepůjde balíček obnovit.', repeat:true, minLength:MIN_PASSWORD_LENGTH, confirmText:'Vytvořit kompletní zálohu'});
        if(!pass) return false;
        $('#saveStatus').textContent = 'Připravuji kompletní zálohu…';
        const packed = await collectBackupFiles();
        if(packed.missing.length){
          const fallback = await confirmDialog(`Kompletní zálohu nelze označit jako úplnou: ${packed.missing.length} očekávaných souborů chybí nebo je nelze přečíst. Datum kompletní zálohy nebude změněno.\n\nChcete místo toho vytvořit pouze šifrovanou datovou zálohu bez souborů?`,{title:'Neúplná kompletní záloha',confirmText:'Vytvořit datovou zálohu'});
          if(fallback) await exportEncryptedJson();
          return false;
        }
        const createdAt = new Date().toISOString();
        const payload = {
          kind:'LifeHub complete backup',
          version:VERSION,
          mode:'complete-with-files',
          createdAt,
          metadata: backupMetadata('complete-with-files', createdAt),
          note:'Obsahuje stav aplikace, metadata i skutečné soubory z IndexedDB. Celý payload je zašifrovaný vnější zálohovací obálkou.',
          stats:{files:packed.files.length, missing:packed.missing.length, totalBytes:packed.totalBytes},
          warnings:packed.missing,
          state:cloneStateForBackup(),
          files:packed.files
        };
        const encrypted = await encryptBackupObject(payload, pass);
        download(`lifehub-kompletni-sifrovana-zaloha-${today()}.json`, JSON.stringify(encrypted,null,2),'application/json;charset=utf-8');
        state.settings.lastCompleteBackupAt = new Date().toISOString();
        save(false); renderBackupStatus();
        toast(`Kompletní záloha vytvořena a ověřena jako úplná (${packed.files.length} souborů, ${formatBytes(packed.totalBytes)}).`, 'good');
        return true;
      }catch(err){ console.error(err); $('#saveStatus').textContent = 'Export selhal'; toast('Kompletní zálohu se nepodařilo vytvořit: '+(err.message||err), 'bad'); return false; }
    }
    function hasForbiddenKeys(obj, depth=0){
      if(!obj || typeof obj !== 'object' || depth>12) return false;
      for(const key of Object.keys(obj)){
        if(FORBIDDEN_IMPORT_KEYS.has(key)) return true;
        if(hasForbiddenKeys(obj[key], depth+1)) return true;
      }
      return false;
    }
    function textLimit(value, max=1000){ return String(value ?? '').replace(/\u0000/g,'').slice(0,max); }
    function sanitizeTags(tags){ return Array.isArray(tags) ? tags.map(t=>textLimit(t,40).trim()).filter(Boolean).slice(0,30) : []; }
    function sanitizeEvidence(evidence){
      const out = {};
      if(!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) return out;
      payFieldDefs.forEach(([key])=>{
        const ev = evidence[key];
        if(!ev || typeof ev !== 'object' || Array.isArray(ev)) return;
        out[key] = {
          value: number(ev.value),
          label: textLimit(ev.label,80),
          snippet: textLimit(ev.snippet,240),
          confidence: ['nízká','střední','vysoká'].includes(ev.confidence) ? ev.confidence : textLimit(ev.confidence,20)
        };
      });
      return out;
    }
    function sanitizeImportedState(input, { preserveStoredFiles = false } = {}){
      const data = migrateStateSchema(input);
      if(!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Záloha nemá očekávaný formát.');
      const approxSize = new Blob([JSON.stringify(data)]).size;
      if(approxSize > 8 * 1024 * 1024) throw new Error('Záloha je příliš velká pro bezpečný import.');
      if(hasForbiddenKeys(data)) throw new Error('Záloha obsahuje zakázané klíče a nebude importována.');
      const clean = defaultState();
      const st = data.settings || {};
      clean.settings = {
        theme:['dark','light'].includes(st.theme) ? st.theme : 'dark',
        greetName:textLimit(st.greetName,40) || 'Dane',
        familyDisplayName:textLimit(st.familyDisplayName,80),
        deviceName:textLimit(st.deviceName,80),
        ownerName:textLimit(st.ownerName,180) || clean.settings.ownerName,
        ownerFooter:textLimit(st.ownerFooter,260) || clean.settings.ownerFooter,
        currency:sanitizeCurrency(st.currency),
        savingGoal:Math.max(0, number(st.savingGoal)),
        foodBudget:st.foodBudget===undefined?DEFAULT_FOOD_BUDGET:Math.max(0, number(st.foodBudget)),
        fuelBudget:st.fuelBudget===undefined?DEFAULT_FUEL_BUDGET:Math.max(0, number(st.fuelBudget)),
        familyMemberId:/^[A-Za-z0-9_-]{1,80}$/.test(String(st.familyMemberId||''))?String(st.familyMemberId):'',
        familyPassword:textLimit(st.familyPassword,256),
        familySettingsUpdatedAt:textLimit(st.familySettingsUpdatedAt,40),
        privateNotifications:st.privateNotifications!==false,
        lastDataBackupAt:textLimit(st.lastDataBackupAt,40),
        lastCompleteBackupAt:textLimit(st.lastCompleteBackupAt,40),
        lastVerifiedBackupAt:textLimit(st.lastVerifiedBackupAt,40),
        lastRestoreAt:textLimit(st.lastRestoreAt,40)
      };
      const asArray=(value,max)=>Array.isArray(value)?value.slice(0,max):[];
      clean.notes = asArray(data.notes,5000).map(n=>({
        id:safeId(n?.id,'note'), title:textLimit(n?.title,180), source:textLimit(n?.source,40)||'Vlastní', priority:Math.min(5,Math.max(1,Number(n?.priority)||3)), type:textLimit(n?.type,40)||'jiné', model:textLimit(n?.model,80), url:safeUrl(n?.url), tags:sanitizeTags(n?.tags), summary:textLimit(n?.summary,3000), content:textLimit(n?.content,50000), next:textLimit(n?.next,1000), createdAt:textLimit(n?.createdAt,40)||new Date().toISOString(), updatedAt:textLimit(n?.updatedAt,40)||new Date().toISOString()
      })).filter(n=>n.title || n.summary || n.content);
      clean.transactions = asArray(data.transactions,10000).map(t=>({
        id:safeId(t?.id,'trans'), date:textLimit(t?.date,10), kind:t?.kind==='expense'?'expense':'income', category:textLimit(t?.category,80)||'bez kategorie', amount:Math.max(0, number(t?.amount)), description:textLimit(t?.description,1000), source:['payroll','payment','installment'].includes(t?.source)?t.source:'manual', payrollId:textLimit(t?.payrollId,100), payrollMonth:textLimit(t?.payrollMonth,7), paymentId:textLimit(t?.paymentId,100), paymentHistoryId:textLimit(t?.paymentHistoryId,100), installmentId:textLimit(t?.installmentId,100), installmentHistoryId:textLimit(t?.installmentHistoryId,100), shared:t?.source==='payroll'?false:t?.shared!==false, createdAt:textLimit(t?.createdAt,40)||new Date().toISOString(), updatedAt:textLimit(t?.updatedAt,40)||new Date().toISOString()
      })).filter(t=>/^\d{4}-\d{2}-\d{2}$/.test(t.date));
      clean.payrolls = asArray(data.payrolls,1000).map(p=>({
        id:safeId(p?.id,'payroll'), month:textLimit(p?.month,7), paymentDate:/^\d{4}-\d{2}-\d{2}$/.test(String(p?.paymentDate||''))?textLimit(p?.paymentDate,10):defaultPayrollPaymentDate(textLimit(p?.month,7)), paymentDateEstimated:p?.paymentDateEstimated===true||!/^\d{4}-\d{2}-\d{2}$/.test(String(p?.paymentDate||'')), employer:textLimit(p?.employer,160), note:textLimit(p?.note,1000), fileName:textLimit(p?.fileName,220), fileSize:Math.max(0, number(p?.fileSize)), fields:sanitizePayrollFields(p?.fields||{}), evidence:sanitizeEvidence(p?.evidence), rawText:textLimit(p?.rawText,200000), storedPdf:preserveStoredFiles ? !!p?.storedPdf : false, createdAt:textLimit(p?.createdAt,40)||new Date().toISOString(), updatedAt:textLimit(p?.updatedAt,40)||''
      })).filter(p=>/^\d{4}-\d{2}$/.test(p.month));
      clean.documents = asArray(data.documents,3000).map(d=>({
        id:safeId(d?.id,'doc'), title:textLimit(d?.title,180)||'Dokument', category:textLimit(d?.category,50)||'jine', date:textLimit(d?.date,10), note:textLimit(d?.note,1000), fileName:textLimit(d?.fileName,220), mime:textLimit(d?.mime,120)||'application/octet-stream', size:Math.max(0, number(d?.size)), createdAt:textLimit(d?.createdAt,40)||new Date().toISOString(), updatedAt:textLimit(d?.updatedAt,40)||new Date().toISOString(), storedFile:preserveStoredFiles ? d?.storedFile !== false : false
      }));
      clean.tasks = asArray(data.tasks,5000).map(t=>{
        const rawP=t?.priority;
        const priority=['high','normal','low'].includes(rawP)?rawP:(rawP==='urgent'?'high':'normal');
        const horizon=['week','month','long'].includes(t?.horizon)?t.horizon:(rawP==='long'?'long':(rawP==='week'?'week':'month'));
        return {id:safeId(t?.id,'task'), title:textLimit(t?.title,180), priority, horizon, due:textLimit(t?.due,10), area:textLimit(t?.area,80), note:textLimit(t?.note,1000), assignedTo:['me','partner','both'].includes(t?.assignedTo)?t.assignedTo:'both', shared:t?.shared!==false, done:!!t?.done, createdAt:textLimit(t?.createdAt,40)||new Date().toISOString(), updatedAt:textLimit(t?.updatedAt,40)||new Date().toISOString()};
      }).filter(t=>t.title);
      clean.shopping = asArray(data.shopping,5000).map(sh=>({
        id:safeId(sh?.id,'shop'), name:textLimit(sh?.name,180), segment:['general','groceries'].includes(sh?.segment)?sh.segment:'general', store:textLimit(sh?.store,60), priority:['urgent','soon','later'].includes(sh?.priority)?sh.priority:'soon', status:['planned','bought','paused'].includes(sh?.status)?sh.status:'planned', category:textLimit(sh?.category,80), price:Math.max(0, number(sh?.price)), month:textLimit(sh?.month,7), url:safeUrl(sh?.url), note:textLimit(sh?.note,1000), shared:sh?.shared!==false, createdAt:textLimit(sh?.createdAt,40)||new Date().toISOString(), updatedAt:textLimit(sh?.updatedAt,40)||new Date().toISOString()
      })).filter(sh=>sh.name);
      clean.apps = asArray(data.apps,2000).map(a=>({
        id:safeId(a?.id,'app'), name:textLimit(a?.name,180), url:safeUrl(a?.url), tag:textLimit(a?.tag,60), note:textLimit(a?.note,1000),
        notes: asArray(a?.notes,2000).map(nt=>({id:safeId(nt?.id,'anote'), text:textLimit(nt?.text,5000), createdAt:textLimit(nt?.createdAt,40)||new Date().toISOString()})).filter(nt=>nt.text),
        createdAt:textLimit(a?.createdAt,40)||new Date().toISOString(), updatedAt:textLimit(a?.updatedAt,40)||new Date().toISOString()
      })).filter(a=>a.name);
      clean.installments = asArray(data.installments,1000).map(i=>({
        id:safeId(i?.id,'inst'), creditor:textLimit(i?.creditor,160), total:Math.max(0,number(i?.total)), monthly:Math.max(0,number(i?.monthly)), startMonth:textLimit(i?.startMonth,7), paid:Math.max(0,number(i?.paid)), dueDay:Math.min(31,Math.max(0,Math.round(number(i?.dueDay)))), note:textLimit(i?.note,1000), assignedTo:['me','partner','both'].includes(i?.assignedTo)?i.assignedTo:'both', shared:i?.shared!==false, paymentHistory:asArray(i?.paymentHistory,5000).map(h=>({id:safeId(h?.id,'ipay'),date:textLimit(h?.date,10),amount:Math.max(0,number(h?.amount)),type:['regular','extra','correction'].includes(h?.type)?h.type:'regular',transactionId:textLimit(h?.transactionId,100),financeDetached:h?.financeDetached===true,createdAt:textLimit(h?.createdAt,40)||new Date().toISOString()})).filter(h=>/^\d{4}-\d{2}-\d{2}$/.test(h.date)), createdAt:textLimit(i?.createdAt,40)||new Date().toISOString(), updatedAt:textLimit(i?.updatedAt,40)||new Date().toISOString()
      })).filter(i=>i.creditor);
      clean.householdPayments = asArray(data.householdPayments,5000).map(p=>({
        id:safeId(p?.id,'pay'), title:textLimit(p?.title,180), category:textLimit(p?.category,80), amount:Math.max(0,number(p?.amount)), frequency:['once','monthly','quarterly','yearly'].includes(p?.frequency)?p.frequency:'once', dueDate:textLimit(p?.dueDate,10), assignedTo:['me','partner','both'].includes(p?.assignedTo)?p.assignedTo:'both', automatic:p?.automatic===true, trackFinance:p?.trackFinance!==false, status:p?.status==='paid'?'paid':'pending', lastPaidAt:textLimit(p?.lastPaidAt,10), note:textLimit(p?.note,1000), shared:p?.shared!==false, paymentHistory:asArray(p?.paymentHistory,5000).map(h=>({id:safeId(h?.id,'hpay'),date:textLimit(h?.date,10),amount:Math.max(0,number(h?.amount)),automatic:h?.automatic===true,transactionId:textLimit(h?.transactionId,100),createdAt:textLimit(h?.createdAt,40)||new Date().toISOString()})).filter(h=>/^\d{4}-\d{2}-\d{2}$/.test(h.date)), createdAt:textLimit(p?.createdAt,40)||new Date().toISOString(), updatedAt:textLimit(p?.updatedAt,40)||new Date().toISOString()
      })).filter(p=>p.title&&/^\d{4}-\d{2}-\d{2}$/.test(p.dueDate));
      clean.budgetEntries = asArray(data.budgetEntries,20000).map(b=>({
        id:safeId(b?.id,'budget'), date:textLimit(b?.date,10), kind:b?.kind==='fuel'?'fuel':'food', amount:Math.max(0,number(b?.amount)), note:textLimit(b?.note,300), shared:b?.shared!==false, createdAt:textLimit(b?.createdAt,40)||new Date().toISOString(), updatedAt:textLimit(b?.updatedAt,40)||new Date().toISOString()
      })).filter(b=>/^\d{4}-\d{2}-\d{2}$/.test(b.date));
      clean.groceries = asArray(data.groceries,5000).map(g=>({
        id:safeId(g?.id,'groc'), name:textLimit(g?.name,160), store:textLimit(g?.store,60), note:textLimit(g?.note,300), done:!!g?.done, shared:g?.shared!==false, createdAt:textLimit(g?.createdAt,40)||new Date().toISOString(), updatedAt:textLimit(g?.updatedAt,40)||new Date().toISOString()
      })).filter(g=>g.name);
      clean.aiEntries = asArray(data.aiEntries,20000).map(a=>({
        id:safeId(a?.id,'ai'), date:textLimit(a?.date,10), minutes:Math.min(1440,Math.max(0,Math.round(number(a?.minutes)))), activity:textLimit(a?.activity,300), note:textLimit(a?.note,500), createdAt:textLimit(a?.createdAt,40)||new Date().toISOString(), updatedAt:textLimit(a?.updatedAt,40)||new Date().toISOString()
      })).filter(a=>/^\d{4}-\d{2}-\d{2}$/.test(a.date)&&a.activity);
      clean.aiClosedMonths = asArray(data.aiClosedMonths,600).map(c=>({
        month:textLimit(c?.month,7), closedAt:textLimit(c?.closedAt,40)||new Date().toISOString()
      })).filter(c=>/^\d{4}-\d{2}$/.test(c.month));
      clean.rewards = asArray(data.rewards,5000).map(r=>({
        id:safeId(r?.id,'rew'), period:normalizeRewardPeriod(textLimit(r?.period,11)), hours:Math.max(0,number(r?.hours)), title:textLimit(r?.title,300), note:textLimit(r?.note,500), createdAt:textLimit(r?.createdAt,40)||new Date().toISOString(), updatedAt:textLimit(r?.updatedAt,40)||new Date().toISOString()
      })).filter(r=>/^\d{4}-\d{4}-(A|B)$/.test(r.period)&&r.title);
      clean.gardenItems = asArray(data.gardenItems,3000).map(g=>({
        id:safeId(g?.id,'gitem'), name:textLimit(g?.name,160), price:Math.max(0,number(g?.price)), horizon:['now','season','year','someday'].includes(g?.horizon)?g.horizon:'season', url:safeUrl(g?.url), note:textLimit(g?.note,500), done:!!g?.done, shared:g?.shared!==false, createdAt:textLimit(g?.createdAt,40)||new Date().toISOString(), updatedAt:textLimit(g?.updatedAt,40)||new Date().toISOString()
      })).filter(g=>g.name);
      clean.gardenLogs = asArray(data.gardenLogs,10000).map(g=>({
        id:safeId(g?.id,'glog'), date:textLimit(g?.date,10), type:['hnojeni','vertikutace','aerifikace','dosev','postrik','sekani','zavlaha','servis','jine'].includes(g?.type)?g.type:'jine', area:textLimit(g?.area,120), note:textLimit(g?.note,500), shared:g?.shared!==false, createdAt:textLimit(g?.createdAt,40)||new Date().toISOString(), updatedAt:textLimit(g?.updatedAt,40)||new Date().toISOString()
      })).filter(g=>/^\d{4}-\d{2}-\d{2}$/.test(g.date));
      clean.partner = sanitizePartnerBlock(data.partner);
      clean.createdAt = textLimit(data.createdAt,40) || clean.createdAt;
      clean.updatedAt = new Date().toISOString();
      clean.version = VERSION;
      clean.schemaVersion = STATE_SCHEMA_VERSION;
      return ensureUniqueIds(clean);
    }
    function confirmPrivateExport(label='Soukromý export'){
      return confirmDialog(`${label} může obsahovat citlivá data, osobní finance, URL, poznámky nebo extrahovaný text z PDF. Pro sdílení použijte anonymizovaný export nebo šifrovanou zálohu. Opravdu pokračovat?`, {title:'Soukromý export', confirmText:'Exportovat'});
    }
    async function exportJson(){
      if(!await confirmPrivateExport('Nešifrovaná datová JSON záloha')) return;
      download(`lifehub-nesifrovana-datova-zaloha-${today()}.json`, JSON.stringify(buildDataBackupPayload({includeFamilyPassword:false}),null,2),'application/json;charset=utf-8');
    }
    async function exportHtml(){if(!await confirmPrivateExport('Soukromý HTML přehled')) return; const html=`<!doctype html><html lang="cs"><meta charset="utf-8"><title>LifeHub export</title><body>${buildMarkdown().split('\n').map(line=>line.startsWith('#')?`<h${Math.min(6,(line.match(/^#+/)?.[0].length||1))}>${esc(line.replace(/^#+\s*/,''))}</h${Math.min(6,(line.match(/^#+/)?.[0].length||1))}>`:line?`<p>${esc(line)}</p>`:'').join('\n')}</body></html>`; download(`lifehub-prehled-${today()}.html`, html, 'text/html;charset=utf-8');}
    async function exportCsv(kind){
      if(!await confirmPrivateExport(`CSV export: ${kind}`)) return;
      const maps={
        notes:[['id','title','source','type','priority','model','url','tags','summary','content','next','createdAt','updatedAt'], ...state.notes.map(n=>[n.id,n.title,n.source,n.type,n.priority,n.model,n.url,(n.tags||[]).join('; '),n.summary,n.content,n.next,n.createdAt,n.updatedAt])],
        transactions:[['id','date','accountingMonth','kind','category','amount','description','source','payrollMonth','paymentId'], ...state.transactions.map(t=>[t.id,t.date,transactionAccountingMonth(t),t.kind,t.category,t.amount,t.description,t.source,t.payrollMonth||'',t.paymentId||''])],
        payrolls:[['id','month','paymentDate','employer','fileName','cleanPay','netPay','grossPay','taxBase','incomeTax','taxpayerDiscount','childDiscount','socialInsurance','healthInsurance','deductions','bonus','note','storedPdf'], ...state.payrolls.map(p=>[p.id,p.month,p.paymentDate||'',p.employer,p.fileName,p.fields?.cleanPay||p.fields?.netPay,p.fields?.netPay||p.fields?.cleanPay,p.fields?.grossPay,p.fields?.taxBase,p.fields?.incomeTax,p.fields?.taxpayerDiscount,p.fields?.childDiscount,p.fields?.socialInsurance,p.fields?.healthInsurance,p.fields?.deductions,p.fields?.bonus,p.note,p.storedPdf])],
        tasks:[['id','title','priority','horizon','due','area','note','done','createdAt'], ...state.tasks.map(t=>[t.id,t.title,t.priority,t.horizon,t.due,t.area,t.note,t.done,t.createdAt])],
        shopping:[['id','name','segment','store','priority','status','category','price','month','url','note','createdAt'], ...state.shopping.map(s=>[s.id,s.name,s.segment,s.store,s.priority,s.status,s.category,s.price,s.month,s.url,s.note,s.createdAt])],
        documents:[['id','title','category','date','fileName','mime','size','note','createdAt','updatedAt'], ...state.documents.map(d=>[d.id,d.title,d.category,d.date,d.fileName,d.mime,d.size,d.note,d.createdAt,d.updatedAt])],
        budget:[['id','date','kind','amount','note','createdAt'], ...state.budgetEntries.map(b=>[b.id,b.date,b.kind,b.amount,b.note,b.createdAt])],
        payments:[['id','title','category','amount','frequency','dueDate','assignedTo','automatic','trackFinance','status','lastPaidAt','note','shared','createdAt','updatedAt'], ...state.householdPayments.map(p=>[p.id,p.title,p.category,p.amount,p.frequency,p.dueDate,p.assignedTo,p.automatic===true,p.trackFinance!==false,p.status,p.lastPaidAt,p.note,p.shared,p.createdAt,p.updatedAt])],
        groceries:[['id','name','store','done','note','createdAt'], ...state.groceries.map(g=>[g.id,g.name,g.store,g.done,g.note,g.createdAt])],
        ailog:[['id','date','minutes','activity','note','createdAt'], ...state.aiEntries.map(a=>[a.id,a.date,a.minutes,a.activity,a.note,a.createdAt])],
        rewards:[['id','period','periodLabel','hours','title','note','createdAt'], ...state.rewards.map(r=>[r.id,r.period,rewardPeriodLabel(r.period),r.hours,r.title,r.note,r.createdAt])],
        garden:[['id','name','price','horizon','url','note','done','createdAt'], ...state.gardenItems.map(g=>[g.id,g.name,g.price,g.horizon,g.url,g.note,g.done,g.createdAt])],
        gardenlog:[['id','date','type','typeLabel','area','note','createdAt'], ...state.gardenLogs.map(g=>[g.id,g.date,g.type,gardenTypeLabel(g.type),g.area,g.note,g.createdAt])]
      };
      download(`lifehub-${kind}-${today()}.csv`, csv(maps[kind]), 'text/csv;charset=utf-8');
    }
    function notesMarkdown(){return ['# Poznámky LifeHub',...state.notes.map(n=>`\n## ${n.title}\n- Zdroj: ${n.source}\n- Typ: ${n.type}\n- Priorita: ${n.priority}/5\n- Model: ${n.model||''}\n- URL: ${n.url||''}\n- Tagy: ${(n.tags||[]).join(', ')}\n\n${mdEscape(n.summary)}\n\n${mdEscape(n.content)}\n\n**Další krok:** ${mdEscape(n.next)}`)].join('\n');}
    function tasksMarkdown(){return ['# Úkoly LifeHub',...state.tasks.map(t=>`\n- [${t.done?'x':' '}] **${t.title}** (${taskPriorityLabel(t.priority)}, ${taskHorizonLabel(t.horizon)}${t.due?', '+t.due:''}) — ${t.area||''}\n  ${t.note||''}`)].join('\n');}
    function shoppingMarkdown(){return ['# Velké nákupy LifeHub',...state.shopping.map(s=>`\n- **${s.name}**${s.store?' ('+s.store+')':''} — ${shopPriorityLabel(s.priority)}, ${fmt(s.price)}, ${s.month||'bez měsíce'}, ${shopStatusLabel(s.status)}\n  ${s.note||''}${s.url?'\n  '+s.url:''}`)].join('\n');}
    function appsMarkdown(){return ['# Moje aplikace',...state.apps.map(a=>`\n## ${a.name}${a.tag?' ('+a.tag+')':''}\n${a.note||''}${a.url?'\n'+a.url:''}\n${(a.notes||[]).map(n=>`- ${mdEscape(n.text)}`).join('\n')}`)].join('\n');}
    function installmentsMarkdown(){return ['# Splátkový kalendář',...state.installments.map(i=>{const c=computeInstallment(i); const history=(i.paymentHistory||[]).map(h=>`\n  - ${h.date}: ${h.type==='extra'?'mimořádná':'běžná'} splátka ${fmt(h.amount)}`).join(''); return `\n- **${i.creditor}** — zbývá ${fmt(c.remaining)} z ${fmt(c.total)}, měsíčně ${fmt(i.monthly)}${c.endMonth?', konec '+monthLabel(c.endMonth):''} • ${assignedToLabel(i.assignedTo)}${i.note?'\n  '+i.note:''}${history}`;})].join('\n');}
    function paymentsMarkdown(){return ['# Účty a závazky',...state.householdPayments.map(p=>`\n- [${p.status==='paid'?'x':' '}] **${p.title}** — ${fmt(p.amount)}, ${paymentFrequencyLabel(p.frequency)}, ${p.automatic?'automaticky hrazeno, další termín':'splatnost'} ${p.dueDate||'neuveden'} • ${assignedToLabel(p.assignedTo)} • ${p.trackFinance!==false?'propojeno s financemi':'bez finančního zápisu'}${p.note?'\n  '+p.note:''}`)].join('\n');}
    function groceriesMarkdown(){return ['# Nákupní seznam',...state.groceries.map(g=>`- [${g.done?'x':' '}] **${g.name}**${g.store?' — '+g.store:''}${g.note?' ('+g.note+')':''}`)].join('\n');}
    function budgetMarkdown(){return ['# Jídlo & benzín',...state.budgetEntries.map(b=>`- ${b.date} | ${b.kind==='fuel'?'Benzín':'Jídlo'} | ${fmt(b.amount)}${b.note?' | '+b.note:''}`)].join('\n');}
    function aiMarkdown(){return ['# AI výkaz',...state.aiEntries.map(a=>`- ${a.date} | ${minutesLabel(a.minutes)} | ${a.activity}${a.note?' | '+a.note:''}`)].join('\n');}
    function gardenMarkdown(){return ['# Zahrada','','## K pořízení',...state.gardenItems.map(g=>`- [${g.done?'x':' '}] **${g.name}** — ${fmt(g.price)}, ${gardenHorizonLabel(g.horizon)}${g.note?' ('+g.note+')':''}${g.url?'\n  '+g.url:''}`),'','## Deník údržby',...state.gardenLogs.map(g=>`- ${g.date} | ${gardenTypeLabel(g.type)}${g.area?' | '+g.area:''}${g.note?' | '+g.note:''}`)].join('\n');}
    function rewardsMarkdown(){return ['# Odměny',...state.rewards.map(r=>`- ${rewardPeriodLabel(r.period)} | ${fmtHours(r.hours)} | ${r.title}${r.note?' | '+r.note:''}`)].join('\n');}
    function buildMarkdown(notion=false){
      const lines=[]; lines.push(`# LifeHub export ${today()}`,'',`Vlastník: ${state.settings.ownerName || ''}`,'');
      lines.push(notesMarkdown(),'', '# Příjmy a výdaje');
      state.transactions.forEach(t=>lines.push(`- ${t.date} | období ${transactionAccountingMonth(t)} | ${t.kind==='income'?'Příjem':'Výdaj'} | ${t.category} | ${fmt(t.amount)} | ${t.description||''}`));
      lines.push('', '# Výplatní pásky'); state.payrolls.forEach(p=>lines.push(`- období ${p.month} | připsáno ${p.paymentDate||'neuvedeno'} | ${p.employer||''} | čistá ${fmt(p.fields?.netPay||0)} | hrubá ${fmt(p.fields?.grossPay||0)} | daň ${fmt(p.fields?.incomeTax||0)} | ${p.note||''}`));
      lines.push('', '# Šifrovaný trezor dokumentů'); state.documents.forEach(d=>lines.push(`- ${d.date||''} | ${d.title||''} | ${docCategoryLabel(d.category)} | ${d.fileName||''} | ${formatBytes(d.size)}`));
      lines.push('', tasksMarkdown(), '', shoppingMarkdown(), '', groceriesMarkdown(), '', gardenMarkdown(), '', budgetMarkdown(), '', paymentsMarkdown(), '', aiMarkdown(), '', rewardsMarkdown(), '', installmentsMarkdown(), '', appsMarkdown());
      if(notion) lines.push('', '---', 'Import do Notion: dlouhé texty vložte jako Markdown stránku; tabulky použijte přes CSV exporty.');
      return lines.join('\n');
    }

    function sumByMonth(){
      const map={};
      state.transactions.forEach(t=>{const m=transactionAccountingMonth(t)||'bez-mesice'; map[m]??={month:m,income:0,expense:0,balance:0,count:0}; const a=number(t.amount); if(t.kind==='income') map[m].income+=a; else map[m].expense+=a; map[m].balance=map[m].income-map[m].expense; map[m].count++;});
      return Object.values(map).sort((a,b)=>String(a.month).localeCompare(String(b.month)));
    }
    function quarterOf(month){
      if(!/^\d{4}-\d{2}/.test(String(month||''))) return 'bez-obdobi';
      const [year,m] = String(month).split('-');
      return `${year}-Q${Math.floor((Number(m)-1)/3)+1}`;
    }
    function moneyRange(value, step=5000){
      const n = Math.max(0, number(value));
      if(!n) return `0 ${sanitizeCurrency(state.settings.currency)}`;
      const low = Math.floor(n/step)*step;
      const high = low + step;
      return `${low.toLocaleString('cs-CZ')}–${high.toLocaleString('cs-CZ')} ${sanitizeCurrency(state.settings.currency)}`;
    }
    function hoursRange(value, step=10){
      const n = Math.max(0, number(value));
      if(!n) return '0';
      const low = Math.floor(n/step)*step;
      return `${low}–${low+step}`;
    }
    function anonymizePayrollFields(fields){
      const out={};
      payFieldDefs.forEach(([key])=>{
        out[key] = key === 'workedHours' ? hoursRange(fields[key]) : moneyRange(fields[key]);
      });
      return out;
    }
    function sumByQuarterAnonymized(){
      const map={};
      state.transactions.forEach(t=>{
        const period = quarterOf(transactionAccountingMonth(t));
        map[period]??={period,income:0,expense:0,balance:0,count:0};
        const a=number(t.amount);
        if(t.kind==='income') map[period].income+=a; else map[period].expense+=a;
        map[period].balance=map[period].income-map[period].expense;
        map[period].count++;
      });
      return Object.values(map).sort((a,b)=>String(a.period).localeCompare(String(b.period))).map(m=>({period:m.period,incomeRange:moneyRange(m.income),expenseRange:moneyRange(m.expense),balanceRange:moneyRange(Math.abs(m.balance)),balanceSign:m.balance>=0?'plus':'minus',count:m.count}));
    }
    function buildAnonymizedSnapshot(){
      const payrolls=state.payrolls.slice().sort((a,b)=>String(a.month).localeCompare(String(b.month))).map((p,i)=>({
        record:`paska_${i+1}`, period:quarterOf(p.month), fields: anonymizePayrollFields(p.fields||{}),
        flags:{hasBonus:!!number(p.fields?.bonus), hasSickPay:!!number(p.fields?.sickPay), hasVacationPay:!!number(p.fields?.vacationPay), hasOvertime:!!number(p.fields?.overtime), hasDeductions:!!number(p.fields?.deductions)},
        noteCategory: classifyPayrollNote(p.note)
      }));
      const shoppingSummary={}; state.shopping.forEach(s=>{const period=quarterOf(s.month); const key=`${period}|${s.priority}|${s.status}`; shoppingSummary[key]??={period,priority:s.priority,status:s.status,count:0,total:0}; shoppingSummary[key].count++; shoppingSummary[key].total+=number(s.price);});
      const taskSummary={}; state.tasks.forEach(t=>{const key=`${t.priority}|${t.done?'done':'open'}`; taskSummary[key]??={priority:t.priority,status:t.done?'done':'open',count:0}; taskSummary[key].count++;});
      const docSummary={}; state.documents.forEach(d=>{const key=d.category||'jine'; docSummary[key]??={category:key,label:docCategoryLabel(key),count:0,totalSize:0}; docSummary[key].count++; docSummary[key].totalSize+=number(d.size);});
      return {kind:'LifeHub anonymized export',version:VERSION,exportedAt:new Date().toISOString(),privacy:'Bez PDF, souborů z archivu, názvů souborů, URL, raw textu, zaměstnavatelů, obsahu poznámek, přesných měsíců a přesných částek.',counts:{notes:state.notes.length,transactions:state.transactions.length,payrolls:state.payrolls.length,documents:state.documents.length,tasks:state.tasks.length,shopping:state.shopping.length},quarterlyFinance:sumByQuarterAnonymized(),payrolls,shoppingSummary:Object.values(shoppingSummary).map(s=>({...s,totalRange:moneyRange(s.total),total:undefined})),taskSummary:Object.values(taskSummary),documentSummary:Object.values(docSummary)};
    }
    function sanitizePayrollFields(fields){
      const out={}; payFieldDefs.forEach(([key])=>out[key]=number(fields[key]));
      if(!(out.cleanPay>0) && out.netPay>0) out.cleanPay=out.netPay;
      if(!(out.netPay>0) && out.cleanPay>0) out.netPay=out.cleanPay;
      return out;
    }
    function classifyPayrollNote(note){ const n=strip(note||''); if(!n) return ''; const labels=[]; if(n.includes('odmen')||n.includes('premi')||n.includes('bonus')) labels.push('odmeny'); if(n.includes('nemoc')) labels.push('nemoc'); if(n.includes('dovol')) labels.push('dovolena'); if(n.includes('prescas')||n.includes('priplat')) labels.push('prescas/priplatky'); return labels.join(', ') || 'poznamka anonymizovana'; }
    function buildAnonymizedMarkdown(){
      const snap=buildAnonymizedSnapshot(); const lines=[];
      lines.push(`# LifeHub anonymizovaný export ${today()}`,'',snap.privacy,'');
      lines.push('## Počty položek',`- Poznámky: ${snap.counts.notes}`,`- Transakce: ${snap.counts.transactions}`,`- Výplatní pásky: ${snap.counts.payrolls}`,`- Dokumenty v lokálním archivu: ${snap.counts.documents}`,`- Úkoly: ${snap.counts.tasks}`,`- Nákupy: ${snap.counts.shopping}`,'');
      lines.push('## Finance po kvartálech'); snap.quarterlyFinance.forEach(m=>lines.push(`- ${m.period}: příjmy ${m.incomeRange}, výdaje ${m.expenseRange}, bilance ${m.balanceSign} ${m.balanceRange}, položek ${m.count}`));
      lines.push('', '## Výplatní pásky bez identifikátorů'); snap.payrolls.forEach(p=>lines.push(`- ${p.period}: čistá ${p.fields.cleanPay||p.fields.netPay}, na účet ${p.fields.netPay||p.fields.cleanPay}, hrubá ${p.fields.grossPay}, daň ${p.fields.incomeTax}, sleva poplatník ${p.fields.taxpayerDiscount}, soc. ${p.fields.socialInsurance}, zdr. ${p.fields.healthInsurance}, srážky ${p.fields.deductions}, pozn.: ${p.noteCategory||'—'}`));
      lines.push('', '## Nákupy souhrnně'); snap.shoppingSummary.forEach(s=>lines.push(`- ${s.period||'bez období'} | ${shopPriorityLabel(s.priority)} | ${shopStatusLabel(s.status)} | ${s.count} položek | ${s.totalRange}`));
      lines.push('', '## Úkoly souhrnně'); snap.taskSummary.forEach(t=>lines.push(`- ${taskPriorityLabel(t.priority)} | ${t.status==='done'?'hotové':'otevřené'} | ${t.count}`));
      lines.push('', '## Dokumenty v archivu souhrnně'); snap.documentSummary.forEach(d=>lines.push(`- ${d.label}: ${d.count} souborů, celkem ${formatBytes(d.totalSize)}`));
      return lines.join('\n');
    }
    function exportAnonymizedPayrollsCsv(){
      const rows=[['record','period','netPayRange','grossPayRange','taxBaseRange','incomeTaxRange','taxpayerDiscountRange','childDiscountRange','socialInsuranceRange','healthInsuranceRange','deductionsRange','mealVouchersRange','bonusRange','sickPayRange','vacationPayRange','overtimeRange','workedHoursRange','employerCostRange','noteCategory']];
      buildAnonymizedSnapshot().payrolls.forEach(p=>rows.push([p.record,p.period,p.fields.cleanPay||p.fields.netPay,p.fields.netPay||p.fields.cleanPay,p.fields.grossPay,p.fields.taxBase,p.fields.incomeTax,p.fields.taxpayerDiscount,p.fields.childDiscount,p.fields.socialInsurance,p.fields.healthInsurance,p.fields.deductions,p.fields.mealVouchers,p.fields.bonus,p.fields.sickPay,p.fields.vacationPay,p.fields.overtime,p.fields.workedHours,p.fields.employerCost,p.noteCategory]));
      download(`lifehub-anonymizovane-pasky-${today()}.csv`, csv(rows), 'text/csv;charset=utf-8');
    }

    function extractDataBackupState(data){
      if(data?.kind === 'LifeHub data backup') return data.state;
      return data;
    }
    function stateCounts(source=state){
      return {
        notes: Array.isArray(source.notes) ? source.notes.length : 0,
        transactions: Array.isArray(source.transactions) ? source.transactions.length : 0,
        payrolls: Array.isArray(source.payrolls) ? source.payrolls.length : 0,
        documents: Array.isArray(source.documents) ? source.documents.length : 0,
        tasks: Array.isArray(source.tasks) ? source.tasks.length : 0,
        shopping: Array.isArray(source.shopping) ? source.shopping.length : 0,
        apps: Array.isArray(source.apps) ? source.apps.length : 0,
        installments: Array.isArray(source.installments) ? source.installments.length : 0,
        householdPayments: Array.isArray(source.householdPayments) ? source.householdPayments.length : 0,
        budgetEntries: Array.isArray(source.budgetEntries) ? source.budgetEntries.length : 0,
        groceries: Array.isArray(source.groceries) ? source.groceries.length : 0,
        aiEntries: Array.isArray(source.aiEntries) ? source.aiEntries.length : 0,
        rewards: Array.isArray(source.rewards) ? source.rewards.length : 0,
        gardenItems: Array.isArray(source.gardenItems) ? source.gardenItems.length : 0,
        gardenLogs: Array.isArray(source.gardenLogs) ? source.gardenLogs.length : 0
      };
    }
    function countsText(c){
      return `- poznámky: ${c.notes}\n- transakce: ${c.transactions}\n- výplatní pásky: ${c.payrolls}\n- dokumenty: ${c.documents}\n- úkoly: ${c.tasks}\n- velké nákupy: ${c.shopping}\n- aplikace/projekty: ${c.apps}\n- splátky: ${c.installments}\n- platby domácnosti: ${c.householdPayments}\n- útraty jídlo/benzín: ${c.budgetEntries}\n- nákupní seznam: ${c.groceries}\n- AI výkaz: ${c.aiEntries}\n- odměny: ${c.rewards}\n- zahrada (položky/údržba): ${c.gardenItems}/${c.gardenLogs}`;
    }
    function describeImportMetadata(data){
      const meta = data?.metadata || {};
      const exportedFrom = textLimit(meta.exportedFrom || data?.exportedFrom || data?.deviceName || '', 100) || 'neuvedeno';
      const exportedAt = textLimit(meta.exportedAt || data?.createdAt || data?.exportedAt || '', 60) || 'neuvedeno';
      const version = textLimit(meta.appVersion || data?.version || '', 40) || 'neuvedeno';
      const type = textLimit(meta.exportType || data?.mode || data?.kind || '', 80) || 'starší formát bez metadat';
      return `- zařízení: ${exportedFrom}\n- datum exportu: ${exportedAt}\n- verze LifeHubu: ${version}\n- typ exportu: ${type}`;
    }
    function backupExportedAt(data){
      const meta = data?.metadata || {};
      return meta.exportedAt || data?.createdAt || data?.exportedAt || '';
    }
    function validDateMs(value){
      const ms = Date.parse(value || '');
      return Number.isFinite(ms) ? ms : 0;
    }
    function backupAgeWarning(data){
      const exportMs = validDateMs(backupExportedAt(data));
      const currentMs = validDateMs(state.updatedAt || state.createdAt);
      if(!exportMs || !currentMs) return '';
      if(exportMs < currentMs - 60000){
        const exportDate = new Date(exportMs).toLocaleString('cs-CZ');
        const currentDate = new Date(currentMs).toLocaleString('cs-CZ');
        return `

⚠️ Pozor: importovaný soubor je starší než aktuální stav tohoto zařízení.
- export: ${exportDate}
- aktuální stav: ${currentDate}
Import může přepsat novější změny starší zálohou.`;
      }
      return '';
    }
    async function parseBackupFile(file){
      assertBackupFileSize(file);
      if(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent||'') && Number(file?.size) > MOBILE_BACKUP_JSON_BYTES){
        throw new Error(`Záloha je pro bezpečné zpracování na tomto mobilním zařízení příliš velká (${formatBytes(file.size)}). Limit je ${formatBytes(MOBILE_BACKUP_JSON_BYTES)}. Obnovu proveďte na počítači nebo použijte menší datovou zálohu.`);
      }
      let data = JSON.parse(await file.text());
      const encryptedEnvelope = data?.kind === 'LifeHub encrypted backup';
      if(encryptedEnvelope){
        const pass = await passwordDialog({title:'Odemknout zálohu', message:'Soubor je šifrovaný. Zadej heslo k této záloze. Aktuální trezor se tímto krokem nemění.', minLength:1, confirmText:'Odemknout zálohu'});
        if(!pass) return null;
        data = await decryptBackupObject(data, pass);
      }
      const isComplete = data?.kind === 'LifeHub complete backup';
      const rawState = isComplete ? data.state : extractDataBackupState(data);
      const imported = sanitizeImportedState(rawState);
      const files = isComplete && Array.isArray(data.files) ? data.files : [];
      const validated = isComplete ? validateBackupFileSet(files, imported) : {records:[], totalBytes:0};
      return {data, imported, files:validated.records, approxBytes:validated.totalBytes, mode:isComplete ? 'complete-with-files' : 'data-only', encryptedEnvelope};
    }
    function buildBackupVerificationMessage(parsed){
      const c = stateCounts(parsed.imported);
      const fileLine = parsed.mode === 'complete-with-files' ? `\n- přibalené soubory: ${parsed.files.length} (${formatBytes(parsed.approxBytes)})` : '\n- přibalené soubory: 0 (datová záloha bez PDF/dokumentů)';
      const modeText = parsed.mode === 'complete-with-files'
        ? 'Kompletní záloha je vhodná pro přenos telefon ↔ PC, protože obsahuje i přibalené soubory.'
        : 'Datová záloha je čitelná, ale nepřenese PDF výplatních pásek ani dokumenty z archivu.';
      return `Záloha je čitelná a nebyl proveden žádný import.

Obsah souboru:
${countsText(c)}${fileLine}

Metadata:
${describeImportMetadata(parsed.data)}

${modeText}${backupAgeWarning(parsed.data)}`;
    }
    async function verifyBackupFile(e){
      const file = e.target.files[0];
      if(!file) return;
      try{
        const parsed = await parseBackupFile(file);
        if(!parsed) return;
        const message = buildBackupVerificationMessage(parsed);
        state.settings.lastVerifiedBackupAt = new Date().toISOString();
        save(false); renderBackupStatus();
        await modalDialog({title:'Ověření zálohy bez importu', message, confirmText:'Zavřít', cancelText:'Zavřít'});
        toast('Záloha byla ověřena. Aktuální data nebyla změněna.', 'good');
      }catch(err){ console.error(err); toast('Zálohu se nepodařilo ověřit: '+(err.message||err), 'bad'); }
      finally{ e.target.value=''; }
    }
    async function confirmImportByTyping(summary, {title='Potvrdit import', confirmText='Importovat'} = {}){
      const word = 'IMPORTOVAT';
      const result = await modalDialog({
        title,
        message:`${summary}

Poslední pojistka: pro potvrzení importu napiš ${word}.`,
        confirmText,
        cancelText:'Zrušit import',
        danger:true,
        fields:[{name:'confirm', label:`Napiš ${word}`, placeholder:word, autocomplete:'off', required:true}],
        validate:values => String(values.confirm || '').trim().toUpperCase() === word ? '' : `Pro pokračování napiš přesně ${word}.`
      });
      return !!result;
    }
    function buildImportPreviewMessage({imported, data, mode='data-only', fileCount=0, approxBytes=0}){
      const current = stateCounts(state);
      const incoming = stateCounts(imported);
      const fileLine = mode === 'complete-with-files' ? `\n- přibalené soubory: ${fileCount} (${formatBytes(approxBytes)})` : '';
      const idbWarning = mode === 'complete-with-files'
        ? 'Kompletní import obnoví i přibalené PDF a dokumenty z IndexedDB. Současné lokální soubory na tomto zařízení budou před obnovou nahrazeny obsahem balíčku.'
        : 'Běžný JSON import nemusí obsahovat fyzické soubory uložené v IndexedDB, například PDF výplatních pásek nebo dokumenty z archivu.';
      return `Import nahradí současný stav tímto souborem.\n\nAktuální zařízení / aktuální trezor:\n${countsText(current)}\n\nImportovaný soubor:\n${countsText(incoming)}${fileLine}\n\nMetadata importu:\n${describeImportMetadata(data)}\n\n${idbWarning}${backupAgeWarning(data)}\n\nPokračovat?`;
    }
    async function offerBackupBeforeImport(){
      const choice = await choiceDialog({
        title:'Záloha před importem',
        message:'Než import přepíše současná data, chceš stáhnout aktuální kompletní zálohu tohoto zařízení?',
        choices:[
          {value:'backup', text:'Stáhnout zálohu a pokračovat', className:'btn primary', autofocus:true},
          {value:'continue', text:'Pokračovat bez zálohy', className:'btn danger'},
          {value:'cancel', text:'Zrušit import', className:'btn'}
        ]
      });
      if(choice === 'cancel' || choice === null) return false;
      if(choice === 'continue') return true;
      const done = await exportCompleteEncryptedBackup();
      if(!done){
        toast('Import byl zastaven, protože aktuální záloha nebyla dokončena.', 'warn');
        return false;
      }
      return true;
    }
    async function prepareBackupFileEntries(files){
      const payrollEntries = [];
      const vaultEntries = [];
      const payrollIds = new Set();
      const docIds = new Set();
      for(const record of files){
        const file = backupRecordToFile(record);
        const encrypted = await cryptoEncryptBlobForIdb(file, vaultKey, VERSION);
        if(record.store === PDF_STORE){ payrollEntries.push([record.id, encrypted]); payrollIds.add(record.id); }
        else{ vaultEntries.push([record.id, encrypted]); docIds.add(record.id); }
      }
      return {payrollEntries, vaultEntries, payrollIds, docIds};
    }
    async function importCompleteBackup(data, parsedInput=null){
      if(!data?.state || typeof data.state !== 'object') throw new Error('Kompletní záloha neobsahuje stav aplikace.');
      const imported = preserveLocalDeviceSettings(parsedInput?.imported || sanitizeImportedState(data.state));
      const migratedGroc = migrateLegacyGroceries(imported);
      const validated = parsedInput ? {records:parsedInput.files, totalBytes:parsedInput.approxBytes} : validateBackupFileSet(data.files, imported);
      if(!await offerBackupBeforeImport()) return;
      const summary = buildImportPreviewMessage({imported, data, mode:'complete-with-files', fileCount:validated.records.length, approxBytes:validated.totalBytes});
      if(!await confirmImportByTyping(summary, {title:'Náhled kompletního importu', confirmText:'Importovat vše'})) return;
      $('#saveStatus').textContent = 'Připravuji bezpečnou obnovu…';
      const prepared = await prepareBackupFileEntries(validated.records);
      imported.payrolls.forEach(p=>{ p.storedPdf = prepared.payrollIds.has(p.id); p.updatedAt = p.updatedAt || new Date().toISOString(); });
      imported.documents.forEach(d=>{ d.storedFile = prepared.docIds.has(d.id); d.updatedAt = d.updatedAt || new Date().toISOString(); });
      imported.settings.lastRestoreAt = new Date().toISOString();
      const envelope = await createEncryptedStateEnvelope(imported, vaultKey, vaultSalt, vaultIterations);
      const restoreId = uid('restore');
      $('#saveStatus').textContent = 'Obnovuji kompletní zálohu…';
      await idbReplaceEncryptedStores({payrollEntries:prepared.payrollEntries, vaultEntries:prepared.vaultEntries, restoreMarker:{restoreId, createdAt:new Date().toISOString(), newEnvelope:envelope}});
      await writeEncryptedStateEnvelope(envelope);
      await idbDeleteMeta('restoreImport');
      state = imported;
      setTheme(state.settings.theme || 'dark');
      hydrateSettings();
      renderAll();
      $('#saveStatus').textContent = 'Záloha obnovena';
      toast(`Kompletní záloha obnovena. Obnoveno ${validated.records.length} souborů.`, 'good');
      if(migratedGroc) toast(`${migratedGroc} položek potravin bylo přesunuto do záložky Nákupní seznam.`);
    }
    async function importJson(e){
      const file=e.target.files[0]; if(!file)return;
      try{
        const parsed = await parseBackupFile(file);
        if(!parsed) return;
        if(parsed.mode === 'complete-with-files'){
          await importCompleteBackup(parsed.data, parsed);
          return;
        }
        const imported = preserveLocalDeviceSettings(parsed.imported);
        const migratedGroc = migrateLegacyGroceries(imported);
        if(!await offerBackupBeforeImport()) return;
        const summary = buildImportPreviewMessage({imported, data:parsed.data, mode:'data-only'});
        if(!await confirmImportByTyping(summary, {title:'Náhled datového importu', confirmText:'Importovat data'})) return;
        imported.settings.lastRestoreAt = new Date().toISOString(); state=imported; setTheme(state.settings.theme||'dark'); save(); hydrateSettings(); renderBackupStatus(); toast('Datová záloha importována po bezpečnostní kontrole. PDF a dokumenty nebyly přeneseny.');
        if(migratedGroc) toast(`${migratedGroc} položek potravin bylo přesunuto do záložky Nákupní seznam.`);
      }
      catch(err){ console.error(err); toast('Soubor se nepodařilo importovat: '+(err.message||err),'bad'); }
      finally{e.target.value='';}
    }
    function renderFamilyPasswordStatus(){
      const configured=!!String(state.settings.familyPassword||'');
      const label=configured?'Nastaveno na tomto zařízení':'Zatím nenastaveno';
      const detail=configured?'Použije se automaticky při vytvoření i načtení rodinného souboru.':'Při prvním vytvoření nebo načtení rodinného souboru ho zadáte jednou.';
      ['familyPasswordStatus','familyPasswordStatusPartner'].forEach(id=>{
        const el=$('#'+id); if(!el)return;
        el.className=`status ${configured?'good':'warn'}`;
        el.textContent=label;
      });
      const info=$('#familyPasswordInfo'); if(info) info.textContent=detail;
    }
    async function setFamilyPassword(){
      const existing=!!String(state.settings.familyPassword||'');
      const pass=await passwordDialog({
        title:existing?'Změnit rodinné heslo':'Nastavit rodinné heslo',
        message:`Stejné heslo nastavte také v LifeHubu partnera. Heslo musí mít alespoň ${MIN_PASSWORD_LENGTH} znaků. Uloží se uvnitř šifrovaného trezoru tohoto zařízení a po 15minutovém automatickém zamknutí se nebude zadávat znovu.`,
        repeat:true,
        minLength:MIN_PASSWORD_LENGTH,
        confirmText:existing?'Změnit heslo':'Uložit heslo'
      });
      if(!pass) return '';
      state.settings.familyPassword=pass;
      state.settings.familySettingsUpdatedAt=new Date().toISOString();
      const saved = await save(false);
      renderFamilyPasswordStatus();
      if(!saved){
        toast('Rodinné heslo se nepodařilo bezpečně uložit. Zkuste uložení zopakovat.', 'bad');
        return '';
      }
      toast(existing?'Rodinné heslo bylo změněno.':'Rodinné heslo bylo bezpečně uloženo v tomto zařízení.','good');
      return pass;
    }
    async function removeFamilyPassword(){
      if(!state.settings.familyPassword){ toast('Rodinné heslo zatím není uložené.','warn'); return; }
      const ok=await confirmDialog('Odstranit uložené rodinné heslo z tohoto zařízení? Při příštím vytvoření nebo načtení rodinného souboru ho bude nutné zadat znovu.',{title:'Odstranit rodinné heslo',confirmText:'Odstranit',danger:true});
      if(!ok)return;
      const previous = state.settings.familyPassword;
      state.settings.familyPassword='';
      const saved = await save(false);
      if(!saved){
        state.settings.familyPassword=previous;
        renderFamilyPasswordStatus();
        toast('Rodinné heslo se nepodařilo odstranit, protože uložení selhalo.', 'bad');
        return;
      }
      renderFamilyPasswordStatus();
      toast('Uložené rodinné heslo bylo odstraněno.','warn');
    }
    function hydrateSettings(){ $('#greetName').value=state.settings.greetName||''; if($('#familyDisplayName')) $('#familyDisplayName').value=state.settings.familyDisplayName||''; $('#deviceName').value=state.settings.deviceName||''; $('#ownerName').value=state.settings.ownerName||''; $('#ownerFooter').value=state.settings.ownerFooter||''; $('#currency').value=state.settings.currency||'Kč'; $('#savingGoal').value=state.settings.savingGoal||0; if($('#privateNotifications')) $('#privateNotifications').checked=state.settings.privateNotifications!==false; renderFamilyPasswordStatus(); }
    function saveSettings(e){e.preventDefault(); state.settings.greetName=$('#greetName').value.trim(); state.settings.familyDisplayName=$('#familyDisplayName')?.value.trim()||''; state.settings.deviceName=$('#deviceName').value.trim(); state.settings.ownerName=$('#ownerName').value.trim(); state.settings.ownerFooter=$('#ownerFooter').value.trim(); state.settings.currency=sanitizeCurrency($('#currency').value); state.settings.savingGoal=number($('#savingGoal').value); state.settings.privateNotifications=$('#privateNotifications')?.checked!==false; state.settings.familySettingsUpdatedAt=new Date().toISOString(); save(); toast('Nastavení uloženo.');}
    // Krátký changelog (nejnovější nahoře, drž ~5 položek). Zobrazí se klepnutím na verzi v patičce.
    const CHANGELOG = [
      'v4.8.5 · Přehled načte výplatu i ze starších pásek bez propojené transakce a chybějící mzdový příjem opraví. Tlačítko celé obrazovky používá skutečný Fullscreen API se záložním režimem. Aktivní otisk nebo zámek telefonu se při otevření spustí automaticky.',
      'v4.8.4 · Přehled nově porovnává připsanou výplatu se všemi skutečnými i plánovanými výdaji. Běžné i mimořádné splátky se automaticky zapisují do financí a starší záznamy se bezpečně doplní.',
      'v4.8.3 · Interaktivní manuál je kompletně sjednocený s biometrií, rodinným sdílením, propojenými financemi, prémiovým AI výkazem a archivy dokončených položek.',
      'v4.8.2 · Dokončené úkoly, koupené a odložené velké nákupy i doplacené splátky mají vlastní rozbalovací archivy s možností návratu.',
      'v4.8.1 · Prémiový měsíční pracovní výkaz s oficiálním logem školy, responzivním HTML a tiskem A4. Měsíční závazky nyní zahrnují také aktivní splátky; živý náhled byl kvůli telefonu odstraněn.',
      'v4.8.0 · Sjednocený dashboard bez duplicit, správná školní období odměn, archiv pořízených zahradních položek, stabilní rozšířený režim, propojení uhrazených účtů s finančními výdaji a rozlišení mzdového období od data připsání výplaty.',
      'v4.7.0 · Rychlé lokální odemčení přes otisk prstu nebo zámek zařízení (WebAuthn PRF), hlavní heslo zůstává zálohou. Rodinný náhled už neopakuje oslovení DANE u každé sekce, používá samostatné jméno pro sdílení a zobrazuje klikatelné URL u velkých a zahradních nákupů.',
      'v4.6.4 · Oprava aktualizace ikony na Androidu: manifest používá nové URL souborů ikon, aby Chrome vytvořil aktualizovaný WebAPK bez odinstalace aplikace.',
      'v4.6.3 · Záložky Finance a Platby byly přejmenovány na Příjmy a výdaje a Účty a závazky. Obě nyní přímo vysvětlují svůj účel, mají vzájemný proklik a upozorňují, že záznamy zatím nejsou automaticky propojené.',
      'v4.6.2 · Plovoucí + je sjednocené napříč záložkami: v Příjmech a výdajích nabízí transakci i výplatní pásku, v Nákupním seznamu rychlou položku, hromadné vložení i fotku a na Zahradě rozlišuje pořízení a údržbu.',
      'v4.6.1 · Spolehlivé aktualizace PWA: nový osobní dashboard, dnešní souhrn, mobilní spodní navigace, kompaktní bezpečnostní panel a přepracované odemknutí.',
      'v4.5.4 · Oprava přímého sdílení přes WhatsApp na Androidu: při systémovém sdílení se používá bezpečný textový obal .lifehub-family.txt, který WhatsApp přijímá; stažená záloha zůstává .lifehub-family.',
      'v4.5.3 · Spolehlivější rodinné sdílení na Androidu: přímá systémová nabídka Sdílet přes…, vlastní přípona .lifehub-family a obecný typ souboru místo JSON.',
      'v4.5.2 · Přehlednější výplatní pásky: dominantní čistá mzda, samostatná částka na účet a méně rušivých technických údajů.',
      'v4.5.1 · Čistší mobilní navigace bez duplicitních názvů kategorií, přehlednější horní lišta, srozumitelnější splátky, automatické platby, hromadný import pásek a chytré hromadné nákupy.',
      'v4.4.1 · Opravena kritická regresní chyba startu: aplikace znovu rozpozná původní trezor, bezpečně dokončí migraci z localStorage do IndexedDB a při chybě úložiště už nikdy nenabídne založení nového trezoru.',
      'v4.4.0 · Stabilizační a bezpečnostní release: IndexedDB pro hlavní stav, ochrana neuložených změn, úplné zálohy, bezpečné zamykání, čisté testovací podklady a jednodušší rodinný snapshot.',
      'v4.3.3 · Kompletní interaktivní manuál je vložen přímo do aplikace, dostupný z horní lišty i postranní nabídky a funguje offline.',
      'v4.3.2 · Rodinné heslo lze uložit jednou uvnitř šifrovaného trezoru. Export i načtení ho používají automaticky a 15minutové zamknutí ho nemaže.',
      'v4.3.1 · Rodinné sdílení je zjednodušeno na bezpečný náhled pouze pro čtení. Načtený soubor nikdy nemění ani neslučuje vlastní data.',
      'v4.3.0 · Nová záložka Platby domácnosti, odpovědná osoba, historie úhrad a splátek a rozšířený šifrovaný rodinný export.',
      'v4.2.0 · Nová záložka Zahrada (věci k pořízení s odkazy a horizontem + deník hnojení, vertikutace, aerifikace a servisu) a záložka Rodina pro náhled sdíleného LifeHubu partnera s převzetím nákupního seznamu.',
      'v4.2.0 · Opravené čtení výplatních pásek Elanor (všechna pole místo jedné hodnoty, automatický měsíc a poznámka), hromadný import pásek z JSON a srozumitelný roční přehled velkých nákupů místo grafu.',
      'v4.1.0 · Nové záložky: Jídlo & benzín s měsíčními limity a roční bilancí, AI výkaz s uzavřením měsíce a PDF výkazem pro vedení a Odměny s podklady pro léto i konec roku.',
      'v4.1.0 · Samostatný Nákupní seznam podle obchodů s hromadným vložením textu a šifrovanými screenshoty; dlužná částka splátek se nově zobrazí při každém odemčení; záložka Nákupy je nyní Velké nákupy.',
      'v4.0.0 · Produkční osobní verze: transakční kompletní obnova, bezpečná změna hesla včetně souborů, ochrana proti přerušeným operacím, přísná validace záloh a automatické testy.',
      'v4.0.0 · Opraveno místní datum, zachování vazby mzdové transakce, limity souborů, diagnostika bez názvu zařízení a úplného user-agentu, mobilní navigace a přístupnost ukazatelů.',
      'v3.4.0 · Ověření zálohy bez importu, potvrzení importu slovem IMPORTOVAT, varování před starší zálohou, průvodce přenosem telefon ↔ PC a diagnostický export.',
      'v3.3.1 · Bezpečnější import, náhled aktuálního a importovaného trezoru a zachování příznaků uložených PDF/dokumentů po odemčení.',
      'v3.3.0 · Kompletní šifrovaná záloha pro přenos telefon ↔ PC včetně PDF výplatních pásek a dokumentů z IndexedDB.'
    ];
    function showChangelog(){ modalDialog({ title:`Novinky · LifeHub ${VERSION}`, message: CHANGELOG.join('\n\n'), confirmText:'Zavřít', cancelText:'Zavřít' }); }
    // Sjednotí zobrazené číslo verze v nadpisu, na zamykací obrazovce a v titulku karty s APP_VERSION.
    function applyVersionLabels(){
      const h=$('#appTitleVersion'); if(h) h.textContent=SHORT_VERSION;
      const l=$('#lockVersion'); if(l) l.textContent=SHORT_VERSION;
      try{ document.title=`LifeHub ${SHORT_VERSION} | šifrovaný trezor, poznámky, finance`; }catch(e){}
    }
    function renderFooter(){ $('#footer').innerHTML=`<strong>${esc(state.settings.ownerName||'Vlastník aplikace: Daniel Baláž · Gymnázium, Ostrava-Hrabůvka')}</strong><br><span>${esc(state.settings.ownerFooter||'© 2026 Daniel Baláž. Všechna práva vyhrazena.')}</span><br><button type="button" class="app-version" data-show-changelog title="Zobrazit novinky">LifeHub v${esc(VERSION)}</button>`;}
    async function showTransferWizard(){
      const choice = await choiceDialog({
        title:'Průvodce přenosem telefon ↔ PC',
        message:`Toto zařízení: ${currentDeviceName()}

Doporučený bezpečný postup:
1. Na zařízení, kde máš nejnovější data, vytvoř kompletní šifrovanou zálohu.
2. Na druhém zařízení nejdřív použij Ověřit zálohu bez importu.
3. Teprve potom importuj a potvrď slovem IMPORTOVAT.

Co chceš udělat teď?`,
        choices:[
          {value:'export', text:'Jsem na hlavním zařízení – vytvořit kompletní zálohu', className:'btn ok', autofocus:true},
          {value:'verify', text:'Jsem na druhém zařízení – ověřit zálohu', className:'btn primary'},
          {value:'help', text:'Zobrazit nápovědu k přenosu', className:'btn secondary'},
          {value:'cancel', text:'Zavřít', className:'btn'}
        ]
      });
      if(choice === 'export') await exportCompleteEncryptedBackup();
      if(choice === 'verify') $('#verifyBackupFile')?.click();
      if(choice === 'help') showTab('help');
    }
    async function countExistingFiles(items, store){
      const keys = new Set((await idbGetKeys(store)).map(String));
      return items.filter(item=>keys.has(String(item.id))).length;
    }
    async function buildDiagnosticsSnapshot(){
      const counts = stateCounts(state);
      const payrollMarked = state.payrolls.filter(p=>p.storedPdf).length;
      const documentMarked = state.documents.filter(d=>d.storedFile !== false).length;
      const payrollInIdb = await countExistingFiles(state.payrolls, PDF_STORE);
      const documentsInIdb = await countExistingFiles(state.documents, VAULT_STORE);
      const jsonBytes = new Blob([JSON.stringify(state)]).size;
      let storageEstimate = null;
      try{ storageEstimate = navigator.storage?.estimate ? await navigator.storage.estimate() : null; }catch(e){ storageEstimate = null; }
      return {
        kind:'LifeHub diagnostic snapshot without personal content',
        appVersion:VERSION,
        exportedAt:new Date().toISOString(),
        deviceLabelConfigured:!!String(state.settings.deviceName||'').trim(),
        deployment:{protocol:location.protocol, standalone:window.matchMedia?.('(display-mode: standalone)').matches || false},
        counts,
        backupStatus:{
          lastDataBackupAt:state.settings.lastDataBackupAt || '',
          lastCompleteBackupAt:state.settings.lastCompleteBackupAt || '',
          lastVerifiedBackupAt:state.settings.lastVerifiedBackupAt || '',
          lastRestoreAt:state.settings.lastRestoreAt || '',
          completeBackupAgeDays:daysSince(state.settings.lastCompleteBackupAt)
        },
        storage:{
          encryptedStatePresent:hasEncryptedState(),
          legacyStatePresent:hasLegacyState(),
          jsonStateBytes:jsonBytes,
          quota:storageEstimate?.quota || null,
          usage:storageEstimate?.usage || null,
          persisted: navigator.storage?.persisted ? await navigator.storage.persisted().catch(()=>null) : null
        },
        indexedDb:{
          payrollPdfMarked:payrollMarked,
          payrollPdfExisting:payrollInIdb,
          documentFilesMarked:documentMarked,
          documentFilesExisting:documentsInIdb
        },
        browser:{
          webCrypto:!!window.crypto?.subtle,
          serviceWorker:'serviceWorker' in navigator,
          online:navigator.onLine,
          language:navigator.language || '',
          platform:navigator.userAgentData?.platform || navigator.platform || 'neuvedeno'
        },
        privacy:'Tento diagnostický export neobsahuje text poznámek, částky transakcí, názvy dokumentů, názvy souborů, raw texty PDF ani obsah souborů.'
      };
    }
    async function exportDiagnostics(){
      try{
        const snapshot = await buildDiagnosticsSnapshot();
        download(`lifehub-diagnostika-bez-osobnich-dat-${today()}.json`, JSON.stringify(snapshot,null,2), 'application/json;charset=utf-8');
        toast('Diagnostika bez osobních dat byla stažena.', 'good');
      }catch(err){ console.error(err); toast('Diagnostiku se nepodařilo vytvořit: '+(err.message||err), 'bad'); }
    }
    async function runDiagnostics(){
      const rows=[]; const ok=(name,detail,good=true)=>rows.push(`<div class="item"><h4>${good?'✅':'⚠️'} ${esc(name)}</h4><p>${esc(detail)}</p></div>`);
      try{localStorage.setItem('lifehub.test','ok'); localStorage.removeItem('lifehub.test'); ok('localStorage','Zápis a čtení lokálních dat funguje.');}catch(e){ok('localStorage','Lokální ukládání nefunguje: '+e.message,false);}
      try{const db=await openDb(); db.close(); ok('IndexedDB','Úložiště pro PDF a šifrovaný trezor funguje.');}catch(e){ok('IndexedDB','Lokální souborové úložiště není dostupné: '+e.message,false);}
      ok('PDF.js', pdfjsLibRef ? 'Knihovna PDF.js je načtená z lokální vendor kopie.' : 'PDF.js je v režimu lazy-load; načte se z lokální složky vendor až při importu PDF. To je očekávané chování.', true);
      ok('Content Security Policy', document.querySelector('meta[http-equiv="Content-Security-Policy"]')?'Základní CSP je nastavena.':'CSP meta tag chybí.', !!document.querySelector('meta[http-equiv="Content-Security-Policy"]'));
      ok('Externí skripty', pdfJsSource==='cdn'?'PDF.js byl načten z CDN, což je chyba konfigurace.':'Při startu se nenačítá žádný externí CDN skript; PDF.js je lokální lazy-load.', pdfJsSource!=='cdn');
      ok('Šifrované úložiště', vaultKey && appReady ? 'Aplikace je odemčená a šifrované ukládání je aktivní.' : 'Aplikace není v odemčeném režimu.', !!vaultKey && appReady);
      ok('Web Crypto API', window.crypto?.subtle?'Web Crypto API je dostupné pro šifrování stavu, souborů i záloh.':`Web Crypto API není dostupné; LifeHub ${SHORT_VERSION} nebude fungovat bezpečně.`, !!window.crypto?.subtle);
      ok('Dialogy aplikace','Potvrzení a hesla používají vlastní modální dialogy místo nativních prompt/confirm, takže jsou použitelné i testovatelné na mobilu.', true);
      const bytes=new Blob([JSON.stringify(state)]).size; ok('Velikost JSON dat', `${(bytes/1024).toFixed(1)} kB v localStorage.`);
      ok('Počty položek', `${state.notes.length} poznámek, ${state.transactions.length} transakcí, ${state.payrolls.length} pásek, ${state.documents.length} dokumentů, ${state.tasks.length} úkolů, ${state.shopping.length} nákupů.`);
      ok('Citlivý obsah', `${state.payrolls.filter(p=>p.rawText).length} uložených raw textů z PDF, ${state.payrolls.filter(p=>p.storedPdf).length} uložených PDF pásek, ${state.documents.length} dokumentů v archivu. V LifeHub ${SHORT_VERSION} se ukládají šifrovaně po odemčení.`, true);
      $('#diagnostics').innerHTML=rows.join('');
    }
    async function seedDemo(){
      if(!await confirmDialog('Vložit ukázková data? Přidají se k současným datům.', {title:'Ukázková data', confirmText:'Vložit'})) return;
      state.notes.unshift({id:uid('note'),title:'Ukázka: dobrý prompt z AI vlákna',source:'ChatGPT',priority:4,type:'prompt',model:'GPT',url:'',tags:['ai','výuka'],summary:'Sem patří krátká pointa užitečného vlákna.',content:'Uložte jen to, co budete později opravdu hledat.',next:'Převést do pracovního listu.',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
      const m=monthNow(); state.transactions.unshift({id:uid('trans'),date:`${m}-01`,kind:'income',category:'mzda',amount:42000,description:'Ukázkový příjem',source:'manual',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()},{id:uid('trans'),date:`${m}-05`,kind:'expense',category:'bydlení',amount:14500,description:'Ukázkový výdaj',source:'manual',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
      state.tasks.unshift({id:uid('task'),title:'Zpracovat poznámky z AI vláken',priority:'high',horizon:'week',due:today(),area:'AI',note:'Ukázkový úkol',done:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
      state.shopping.unshift({id:uid('shop'),name:'Ukázkový nákup (lednička)',segment:'general',store:'',priority:'soon',status:'planned',category:'technika',price:6000,month:m,url:'',note:'Ukázka pro graf',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()},{id:uid('shop'),name:'Mléko, pečivo, vejce',segment:'groceries',store:'Lidl',priority:'urgent',status:'planned',category:'potraviny',price:250,month:m,url:'',note:'Běžný nákup',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
      state.apps.unshift({id:uid('app'),name:'LUDUS (ukázka)',url:'',tag:'hra',note:'Vzdělávací herní platforma',notes:[{id:uid('anote'),text:'Nápad: přidat režim učitele i do nové hry.',createdAt:new Date().toISOString()}],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
      state.installments.unshift({id:uid('inst'),creditor:'Ukázková půjčka',total:60000,monthly:5000,startMonth:m,paid:0,dueDay:15,note:'Ukázka splátkového kalendáře',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
      state.budgetEntries.unshift({id:uid('budget'),date:`${m}-03`,kind:'food',amount:850,note:'Ukázka: nákup Lidl',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()},{id:uid('budget'),date:`${m}-04`,kind:'fuel',amount:1200,note:'Ukázka: tankování',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
      state.groceries.unshift({id:uid('groc'),name:'Mléko (ukázka)',store:'Lidl',note:'',done:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()},{id:uid('groc'),name:'Chleba (ukázka)',store:'Albert',note:'',done:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
      state.aiEntries.unshift({id:uid('ai'),date:today(),minutes:90,activity:'Ukázka: příprava testu v generátoru',note:'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
      state.rewards.unshift({id:uid('rew'),period:currentRewardPeriod(),hours:4.5,title:'Ukázka: vývoj školní aplikace',note:'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
      state.gardenItems.unshift({id:uid('gitem'),name:'Podzimní hnojivo (ukázka)',price:890,horizon:'season',url:'',note:'Ukázková položka',done:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
      state.gardenLogs.unshift({id:uid('glog'),date:today(),type:'hnojeni',area:'přední trávník',note:'Ukázkový záznam údržby',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
      populateRewardPeriodSelects();
      save(); toast('Ukázková data vložena.');
    }
    async function clearAllData(){
      if(!await confirmDialog('Opravdu smazat všechna lokální data aplikace včetně šifrovaného stavu, PDF a dokumentů v IndexedDB?', {title:'Smazat všechna lokální data', confirmText:'Smazat vše', danger:true}))return;
      state=defaultState();
      try{ await deleteEncryptedStateEnvelope(); localStorage.removeItem(LEGACY_STORE); }catch(e){ console.warn(e); }
      try{ await idbClear(PDF_STORE); await idbClear(VAULT_STORE); }catch(e){ console.warn(e); toast('Metadata byla smazána, ale vyčištění IndexedDB se nemuselo podařit.', 'warn'); }
      vaultKey=null; vaultSalt=null; vaultIterations=KDF_ITERATIONS; appReady=false;
      hydrateSettings(); setTheme(state.settings.theme); renderAll(); toast('Lokální data byla smazána včetně šifrovaného úložiště.','warn');
      await startSecureGate();
    }
    // ===== Moje aplikace =====
    function renderApps(){
      const listView=$('#appsListView'), detailView=$('#appDetailView'); if(!listView||!detailView) return;
      const app = selectedAppId ? state.apps.find(a=>a.id===selectedAppId) : null;
      if(!app){ selectedAppId=null; listView.classList.remove('hide'); detailView.classList.add('hide'); renderAppsList(); return; }
      listView.classList.add('hide'); detailView.classList.remove('hide');
      const url=safeUrl(app.url);
      $('#appDetailTitle').innerHTML=`<h2 class="tab-title">${esc(app.name)}</h2>${app.tag?`<span class="tag">${esc(app.tag)}</span>`:''}`;
      $('#appDetailMeta').innerHTML=`<p class="tab-hint">${(app.notes||[]).length} poznámek${app.note?' • '+esc(app.note):''}${url?` • <a href="${attr(url)}" target="_blank" rel="noopener noreferrer">otevřít ↗</a>`:''}</p>`;
      const notes=[...(app.notes||[])].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
      $('#appNotesList').innerHTML=notes.map(n=>`<article class="app-note"><p class="app-note-text">${esc(n.text)}</p><div class="item-top"><span class="app-note-date">${esc(fmtDate(n.createdAt))}</span><button class="mini-btn" data-del-app-note="${attr(n.id)}" type="button">Smazat</button></div></article>`).join('') || empty('Zatím žádné poznámky. Přidej první přes tlačítko +.');
    }
    function renderAppsList(){
      const q=strip($('#appSearch')?.value||''), sort=$('#appSort')?.value||'new';
      let arr=state.apps.filter(a=>!q||strip([a.name,a.tag,a.note,(a.notes||[]).map(n=>n.text).join(' ')].join(' ')).includes(q));
      arr.sort((a,b)=> sort==='name'?String(a.name).localeCompare(String(b.name),'cs'): sort==='notes'?(b.notes||[]).length-(a.notes||[]).length : new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt));
      $('#appsList').innerHTML=arr.map(a=>{const url=safeUrl(a.url);return `<article class="item"><div class="item-top"><div><h4>${esc(a.name)}</h4><p>${esc(a.note||'Bez popisu')}</p></div><div class="actions"><button class="mini-btn" data-open-app="${attr(a.id)}" type="button">Otevřít</button><button class="mini-btn" data-edit-app="${attr(a.id)}" type="button">Upravit</button><button class="mini-btn" data-delete-app="${attr(a.id)}" type="button">Smazat</button></div></div><div class="meta"><span class="tag">${(a.notes||[]).length} poznámek</span>${a.tag?`<span class="tag">${esc(a.tag)}</span>`:''}${url?`<span class="tag">🔗 odkaz</span>`:''}</div></article>`;}).join('') || empty('Zatím tu nejsou aplikace. Přidej první přes tlačítko +.');
    }
    function saveApp(e){e.preventDefault(); const id=$('#appId').value||uid('app'); const existing=state.apps.find(a=>a.id===id); const a={id,name:$('#appName').value.trim(),url:safeUrl($('#appUrl').value),tag:$('#appTag').value.trim(),note:$('#appNote').value.trim(),notes:existing?.notes||[],createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()}; if(existing)Object.assign(existing,a); else state.apps.unshift(a); save(); resetAppForm(); toast('Aplikace uložena.');}
    function resetAppForm(){ $('#appForm').reset(); $('#appId').value=''; }
    function editApp1(id){const a=state.apps.find(x=>x.id===id); if(!a)return; selectedAppId=null; renderApps(); toggleAddCard('appAddCard',true); $('#appId').value=a.id; $('#appName').value=a.name; $('#appUrl').value=a.url||''; $('#appTag').value=a.tag||''; $('#appNote').value=a.note||''; $('#appName').focus();}
    async function deleteApp(id){ if(!await confirmDialog('Opravdu smazat tuto aplikaci i s jejími poznámkami?', {title:'Smazat aplikaci', confirmText:'Smazat', danger:true})) return; state.apps=state.apps.filter(a=>a.id!==id); if(selectedAppId===id) selectedAppId=null; save(); toast('Aplikace smazána.','warn'); }
    function openApp1(id){ selectedAppId=id; renderApps(); window.scrollTo({top:0,behavior:'smooth'}); }
    function saveAppNote(e){e.preventDefault(); const app=state.apps.find(a=>a.id===selectedAppId); if(!app){toast('Nejdřív otevři aplikaci.','warn');return;} const text=$('#appNoteText').value.trim(); if(!text) return; app.notes=app.notes||[]; app.notes.unshift({id:uid('anote'),text,createdAt:new Date().toISOString()}); app.updatedAt=new Date().toISOString(); save(); $('#appNoteForm').reset(); toggleAddCard('appNoteAddCard',false); toast('Poznámka přidána.');}
    async function deleteAppNote(noteId){ const app=state.apps.find(a=>a.id===selectedAppId); if(!app) return; if(!await confirmDialog('Smazat tuto poznámku?', {title:'Smazat poznámku', confirmText:'Smazat', danger:true})) return; app.notes=(app.notes||[]).filter(n=>n.id!==noteId); app.updatedAt=new Date().toISOString(); save(); toast('Poznámka smazána.','warn'); }

    // ===== Splátkový kalendář =====
    function addMonths(m,n){ if(!/^\d{4}-\d{2}$/.test(m||'')) m=monthNow(); let [y,mo]=m.split('-').map(Number); const idx=(y*12+(mo-1))+n; return `${Math.floor(idx/12)}-${pad((idx%12)+1)}`; }
    function maxMonth(a,b){ const va=/^\d{4}-\d{2}$/.test(a||'')?a:''; const vb=/^\d{4}-\d{2}$/.test(b||'')?b:''; if(!va) return vb||monthNow(); if(!vb) return va; return va>=vb?va:vb; }
    function computeInstallment(i){
      const total=Math.max(0,number(i.total)), monthly=Math.max(0,number(i.monthly));
      // "Splaceno" = jen skutecne zaznamenane splatky (bezne + mimoradne). Nova pujcka zacina na 0 -> zbyva cela castka.
      const paid = Math.min(total, Math.max(0,number(i.paid)));
      const monthsTotal = monthly>0 ? Math.ceil(total/monthly) : 0;
      const remaining = Math.max(0, total-paid);
      const remainingMonths = monthly>0 ? Math.ceil(remaining/monthly) : 0;
      // Konec = projekce od pozdejsiho z (pocatek, aktualni mesic); mimoradna splatka ho posune driv.
      const anchor = maxMonth(i.startMonth, monthNow());
      const endMonth = (remaining>0 && monthly>0) ? addMonths(anchor, remainingMonths-1) : '';
      const progress = total>0 ? Math.round(paid/total*100) : 0;
      return {total, monthly, monthsTotal, paid, remaining, remainingMonths, endMonth, progress};
    }
    function renderInstallments(){
      const activeBox=$('#installmentsList'); if(!activeBox) return;
      const computed=state.installments.map(i=>({i,c:computeInstallment(i)}));
      const active=computed.filter(x=>x.c.remaining>0).sort((a,b)=>b.c.remaining-a.c.remaining);
      const completed=computed.filter(x=>x.c.remaining<=0).sort((a,b)=>String(b.i.updatedAt||b.i.createdAt).localeCompare(String(a.i.updatedAt||a.i.createdAt)));
      const totalRemaining=active.reduce((a,x)=>a+x.c.remaining,0);
      const monthlySum=active.reduce((a,x)=>a+Math.min(x.c.monthly,x.c.remaining),0);
      const nextEnd=active.map(x=>x.c.endMonth).filter(Boolean).sort()[0]||'';
      const remainingPayments=active.reduce((sum,x)=>sum+x.c.remainingMonths,0);
      const activeLabel=active.length===1?'1 aktivní kalendář':`${active.length} aktivní kalendáře`;
      $('#installmentKpis').innerHTML=[kpi('Zbývá splatit',fmt(totalRemaining),activeLabel),kpi('Měsíčně celkem',fmt(monthlySum),'Plánovaná měsíční úhrada'),kpi('Zbývající platby',remainingPayments,'Odhad počtu měsíčních úhrad'),kpi('Nejbližší konec',nextEnd?monthLabel(nextEnd):'—','Měsíc poslední splátky')].join('');
      activeBox.innerHTML=active.map(({i,c})=>installmentCard(i,c,false)).join('') || empty('Žádné aktivní splátky. Přidej první přes tlačítko +.');
      const completedArchive=$('#installmentsCompletedArchive'); if(completedArchive) completedArchive.hidden=!completed.length;
      const completedCount=$('#installmentsCompletedCount'); if(completedCount) completedCount.textContent=String(completed.length);
      const completedList=$('#installmentsCompletedList'); if(completedList) completedList.innerHTML=completed.map(({i,c})=>installmentCard(i,c,true)).join('')||empty('Archiv doplacených splátek je prázdný.');
    }
    function installmentCard(i,c,done=false){
      const history=(i.paymentHistory||[]).slice(0,20);
      const historyLabel=h=>h.type==='extra'?'Mimořádná':h.type==='correction'?'Oprava':'Běžná';
      const historyHtml=history.length?`<details class="history"><summary>Historie plateb (${i.paymentHistory.length})</summary><div class="history-list">${history.map(h=>`<div><span>${esc(fmtDate(`${h.date}T00:00:00`))}</span><strong>${esc(historyLabel(h))} ${h.type==='correction'?'−':''}${fmt(Math.abs(number(h.amount)))}</strong></div>`).join('')}</div></details>`:'';
      return `<article class="item ${done?'archive-item':''}"><div class="item-top"><div><h4>${esc(i.creditor)}${done?' ✅':''}</h4><p><span class="installment-remaining ${done?'money-plus':'money-minus'}">${done?'Doplaceno':'Zbývá '+fmt(c.remaining)}</span> • měsíčně ${fmt(i.monthly)} • celkem ${fmt(c.total)}</p>${i.note?`<p>${esc(i.note)}</p>`:''}</div><div class="actions">${done?`<button class="mini-btn" data-reopen-inst="${attr(i.id)}" type="button">Znovu otevřít</button>`:`<button class="mini-btn" data-pay-inst="${attr(i.id)}" type="button">+ splátka</button><button class="mini-btn" data-extra-inst="${attr(i.id)}" type="button">+ mimořádná</button>`}<button class="mini-btn" data-edit-inst="${attr(i.id)}" type="button">Upravit</button><button class="mini-btn" data-delete-inst="${attr(i.id)}" type="button">Smazat</button></div></div>${barRow(`Splaceno ${fmt(c.paid)} z ${fmt(c.total)}`, c.progress+'%', c.progress)}<div class="meta">${c.endMonth?`<span class="tag">konec ${esc(monthLabel(c.endMonth))}</span>`:''}<span class="tag">zbývá ${c.remainingMonths} měs.</span>${i.startMonth?`<span class="tag">od ${esc(monthLabel(i.startMonth))}</span>`:''}${i.dueDay?`<span class="tag">splatnost ${esc(String(i.dueDay))}. v měsíci</span>`:''}<span class="tag">${esc(assignedToLabel(i.assignedTo))}</span>${i.shared!==false?'<span class="tag">👥 sdílené</span>':'<span class="tag">🔒 soukromé</span>'}</div>${historyHtml}</article>`;
    }
    function saveInstallment(e){
      e.preventDefault();
      const total=number($('#instTotal').value), monthly=number($('#instMonthly').value);
      if(!(total>0) || !(monthly>0)){toast('Celková částka i měsíční splátka musí být vyšší než nula.','bad');return;}
      const id=$('#instId').value||uid('inst');
      const existing=state.installments.find(x=>x.id===id);
      const i={id,creditor:$('#instCreditor').value.trim(),total,monthly,startMonth:$('#instStart').value,paid:number($('#instPaid').value),dueDay:Math.min(31,Math.max(0,Math.round(number($('#instDueDay').value)))),note:$('#instNote').value.trim(),assignedTo:['me','partner','both'].includes($('#instAssignedTo')?.value)?$('#instAssignedTo').value:'both',shared:!!$('#instShared')?.checked,paymentHistory:Array.isArray(existing?.paymentHistory)?existing.paymentHistory:[],createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
      if(existing){ Object.assign(existing,i); refreshLinkedInstallmentTransactions(existing); }
      else state.installments.unshift(i);
      save(); resetInstallmentForm(); toast('Splátkový kalendář uložen.');
    }
    function resetInstallmentForm(){ $('#instForm').reset(); $('#instId').value=''; $('#instStart').value=monthNow(); if($('#instShared')) $('#instShared').checked=true; if($('#instAssignedTo')) $('#instAssignedTo').value='both'; }
    function editInstallment(id){const i=state.installments.find(x=>x.id===id); if(!i)return; showTab('installments'); toggleAddCard('instAddCard',true); $('#instId').value=i.id; $('#instCreditor').value=i.creditor; $('#instTotal').value=i.total||''; $('#instMonthly').value=i.monthly||''; $('#instStart').value=i.startMonth||monthNow(); $('#instPaid').value=i.paid||''; $('#instDueDay').value=i.dueDay||''; $('#instNote').value=i.note||''; if($('#instAssignedTo')) $('#instAssignedTo').value=i.assignedTo||'both'; if($('#instShared')) $('#instShared').checked=i.shared!==false; $('#instCreditor').focus();}
    function installmentTransactionDescription(installment,historyEntry){
      const type=historyEntry?.type==='extra'?'mimořádná splátka':'běžná splátka';
      return `${installment.creditor} • ${type}`;
    }
    function upsertInstallmentTransaction(installment,historyEntry){
      if(!historyEntry || historyEntry.financeDetached===true || historyEntry.type==='correction' || !(number(historyEntry.amount)>0)) return '';
      let transaction=state.transactions.find(t=>t.id===historyEntry.transactionId) || state.transactions.find(t=>t.source==='installment'&&t.installmentHistoryId===historyEntry.id);
      if(!transaction && installment?.creditor){
        const creditorKey=strip(installment.creditor);
        transaction=state.transactions.find(t=>t.source==='manual'&&t.kind==='expense'&&t.date===historyEntry.date&&Math.abs(number(t.amount)-number(historyEntry.amount))<0.01&&strip([t.category,t.description].join(' ')).includes(creditorKey));
      }
      const values={
        date:historyEntry.date,kind:'expense',category:'splátky',amount:Math.max(0,number(historyEntry.amount)),
        description:installmentTransactionDescription(installment,historyEntry),source:'installment',installmentId:installment.id,installmentHistoryId:historyEntry.id,
        shared:installment.shared!==false,updatedAt:new Date().toISOString()
      };
      if(transaction) Object.assign(transaction,values);
      else{
        transaction={id:uid('trans'),...values,createdAt:new Date().toISOString()};
        state.transactions.unshift(transaction);
      }
      historyEntry.transactionId=transaction.id;
      return transaction.id;
    }
    function refreshLinkedInstallmentTransactions(installment){
      for(const historyEntry of installment.paymentHistory||[]){
        if(historyEntry.type==='correction') continue;
        const linked=historyEntry.transactionId && state.transactions.some(t=>t.id===historyEntry.transactionId);
        if(linked) upsertInstallmentTransaction(installment,historyEntry);
      }
    }
    function reconcileInstallmentTransactions(){
      let created=0;
      for(const installment of state.installments){
        for(const historyEntry of installment.paymentHistory||[]){
          if(historyEntry.financeDetached===true || historyEntry.type==='correction' || !(number(historyEntry.amount)>0)) continue;
          const existed=state.transactions.some(t=>t.id===historyEntry.transactionId || (t.source==='installment'&&t.installmentHistoryId===historyEntry.id));
          upsertInstallmentTransaction(installment,historyEntry);
          if(!existed) created++;
        }
      }
      return created;
    }
    async function deleteInstallment(id){
      const installment=state.installments.find(item=>item.id===id); if(!installment) return;
      const historyIds=new Set((installment.paymentHistory||[]).map(row=>row.id));
      const linkedCount=state.transactions.filter(t=>t.source==='installment'&&(t.installmentId===id||historyIds.has(t.installmentHistoryId))).length;
      const message=linkedCount
        ? `Smazat splátkový kalendář „${installment.creditor}“? Současně se odstraní ${linkedCount} propojených finančních ${linkedCount===1?'záznam':'záznamů'}, aby v bilanci nezůstaly osiřelé výdaje.`
        : `Smazat splátkový kalendář „${installment.creditor}“?`;
      if(!await confirmDialog(message,{title:'Smazat splátku',confirmText:'Smazat',danger:true})) return;
      state.installments=state.installments.filter(item=>item.id!==id);
      state.transactions=state.transactions.filter(t=>!(t.source==='installment'&&(t.installmentId===id||historyIds.has(t.installmentHistoryId))));
      save(); toast('Splátka a její propojené finanční záznamy byly smazány.','warn');
    }
    async function reopenInstallment(id){
      const i=state.installments.find(x=>x.id===id); if(!i)return;
      const c=computeInstallment(i);
      if(c.remaining>0){ toast('Splátkový kalendář je už aktivní.','warn'); return; }
      const values=await modalDialog({
        title:'Znovu otevřít splátku',
        message:`${i.creditor} je vedená jako doplacená. Zadej částku, která má znovu zbývat.`,
        confirmText:'Vrátit mezi aktivní',
        fields:[{name:'remaining',label:'Zbývající částka',type:'number',placeholder:String(Math.max(1,Math.round(number(i.monthly)||1)))}]
      });
      if(!values) return;
      const remaining=Math.min(number(i.total),Math.max(0,number(values.remaining)));
      if(!(remaining>0)){ toast('Zbývající částka musí být vyšší než nula.','bad'); return; }
      i.paid=Math.max(0,number(i.total)-remaining);
      i.paymentHistory=Array.isArray(i.paymentHistory)?i.paymentHistory:[];
      i.paymentHistory.unshift({id:uid('ipay'),date:today(),amount:remaining,type:'correction',createdAt:new Date().toISOString()});
      i.updatedAt=new Date().toISOString();
      save();
      toast(`Splátka byla vrácena mezi aktivní. Zbývá ${fmt(remaining)}.`);
    }
    function recordInstallmentPayment(id){
      const i=state.installments.find(x=>x.id===id); if(!i)return;
      const payment=calculateRegularInstallmentPayment(i);
      if(payment.appliedAmount<=0){toast('Není co zaplatit nebo není nastavena kladná měsíční splátka.','warn');return;}
      i.paid=payment.newPaid;
      i.paymentHistory=Array.isArray(i.paymentHistory)?i.paymentHistory:[];
      const historyEntry={id:uid('ipay'),date:today(),amount:payment.appliedAmount,type:'regular',createdAt:new Date().toISOString()};
      i.paymentHistory.unshift(historyEntry);
      upsertInstallmentTransaction(i,historyEntry);
      i.updatedAt=new Date().toISOString();
      save();
      toast(payment.completed?`Splátka ${fmt(payment.appliedAmount)} zaznamenána jako výdaj – doplaceno! 🎉`:`Splátka ${fmt(payment.appliedAmount)} zaznamenána a přidána do Příjmů a výdajů.`);
    }
    async function recordExtraPayment(id){
      const i=state.installments.find(x=>x.id===id); if(!i)return;
      const c=computeInstallment(i);
      if(c.remaining<=0){ toast('Tato splátka je už doplacená.','warn'); return; }
      const values = await modalDialog({
        title:'Mimořádná splátka',
        message:`${i.creditor}: zbývá ${fmt(c.remaining)}. Zadej částku mimořádné splátky (nad rámec běžné měsíční splátky).`,
        confirmText:'Zaznamenat',
        fields:[{name:'amount', label:'Částka mimořádné splátky', type:'number', placeholder:String(Math.round(c.remaining))}],
        validate:v=>{ const n=number(v.amount); if(!(n>0)) return 'Zadej kladnou částku.'; return ''; }
      });
      if(!values) return;
      const amount = Math.min(c.remaining, Math.max(0, number(values.amount)));
      if(amount<=0) return;
      i.paid = Math.min(c.total, c.paid + amount); i.paymentHistory=Array.isArray(i.paymentHistory)?i.paymentHistory:[];
      const historyEntry={id:uid('ipay'),date:today(),amount,type:'extra',createdAt:new Date().toISOString()};
      i.paymentHistory.unshift(historyEntry); upsertInstallmentTransaction(i,historyEntry); i.updatedAt=new Date().toISOString(); save();
      const rem = Math.max(0, c.total - i.paid);
      toast(rem<=0 ? `Mimořádná splátka ${fmt(amount)} zaznamenána jako výdaj – doplaceno! 🎉` : `Mimořádná splátka ${fmt(amount)} zaznamenána jako výdaj. Zbývá ${fmt(rem)}.`);
    }
    async function enableInstallmentNotifications(){
      if(!('Notification' in window)){ toast('Tento prohlížeč nepodporuje notifikace.','warn'); return; }
      try{
        const p = await Notification.requestPermission();
        if(p==='granted'){ toast('Notifikace povoleny. Týdenní přehled uvidíš po otevření aplikace.'); maybeWeeklyInstallmentReminder(true); }
        else toast('Notifikace nebyly povoleny.','warn');
      }catch(err){ toast('Notifikace se nepodařilo povolit.','warn'); }
    }
    function maybeWeeklyInstallmentReminder(force=false){
      const active=state.installments.map(computeInstallment).filter(c=>c.remaining>0);
      if(!active.length) return;
      const key='lifehub.lastInstNotif';
      let last=0; try{ last=Number(localStorage.getItem(key))||0; }catch(e){}
      const now=Date.now();
      if(!force && (now-last) < 7*24*3600*1000) return;
      try{ localStorage.setItem(key,String(now)); }catch(e){}
      if('Notification' in window && Notification.permission==='granted'){
        const activeItems=state.installments.map(i=>({i,c:computeInstallment(i)})).filter(x=>x.c.remaining>0);
        const body=state.settings.privateNotifications!==false ? `Máte ${activeItems.length} aktivních splátek. Podrobnosti zobrazíte po odemčení LifeHubu.` : activeItems.map(x=>`${x.i.creditor}: zbývá ${fmt(x.c.remaining)}`).join('\n');
        try{ new Notification('LifeHub – splátky', {body, tag:'lifehub-installments'}); }catch(e){}
      }
    }
    // ===== Popup dluhu ze splátek při každém odemčení =====
    function showInstallmentDebtOnOpen(){
      const active=state.installments.map(computeInstallment).filter(c=>c.remaining>0);
      if(!active.length) return;
      const total=active.reduce((a,c)=>a+c.remaining,0);
      const monthly=active.reduce((a,c)=>a+c.monthly,0);
      const label=active.length===1?'1 aktivní splátkový kalendář':`${active.length} aktivní splátkové kalendáře`;
      toast(`📆 ${label}: zbývá ${fmt(total)}, plánovaná měsíční úhrada ${fmt(monthly)}.`);
    }

    // ===== Platby domácnosti =====
    const PAYMENT_FREQUENCY_LABELS = {once:'Jednorázově',monthly:'Měsíčně',quarterly:'Čtvrtletně',yearly:'Ročně'};
    function paymentFrequencyLabel(value){ return PAYMENT_FREQUENCY_LABELS[value] || PAYMENT_FREQUENCY_LABELS.once; }
    function assignedToLabel(value){ return value==='me'?'Já':value==='partner'?'Partner':'Oba'; }
    function partnerAssignedToLabel(value,ownerName){ return value==='me'?(ownerName||'Partner'):value==='partner'?'Ty':'Oba'; }
    function paymentTransactionDescription(payment){
      return `${payment.title}${payment.frequency!=='once'?` • ${paymentFrequencyLabel(payment.frequency)}`:''}`;
    }
    function upsertPaymentTransaction(payment,historyEntry){
      if(!historyEntry || !(number(historyEntry.amount)>0)) return '';
      let transaction=state.transactions.find(t=>t.id===historyEntry.transactionId) || state.transactions.find(t=>t.source==='payment'&&t.paymentHistoryId===historyEntry.id);
      if(!payment?.trackFinance && !transaction) return '';
      const values={
        date:historyEntry.date,kind:'expense',category:payment.category||'účty a závazky',amount:Math.max(0,number(historyEntry.amount)),
        description:paymentTransactionDescription(payment),source:'payment',paymentId:payment.id,paymentHistoryId:historyEntry.id,
        shared:payment.shared!==false,updatedAt:new Date().toISOString()
      };
      if(transaction) Object.assign(transaction,values);
      else{
        transaction={id:uid('trans'),...values,createdAt:new Date().toISOString()};
        state.transactions.unshift(transaction);
      }
      historyEntry.transactionId=transaction.id;
      return transaction.id;
    }
    function removePaymentTransaction(historyEntry){
      const id=historyEntry?.transactionId;
      if(id) state.transactions=state.transactions.filter(t=>t.id!==id);
      else if(historyEntry?.id) state.transactions=state.transactions.filter(t=>!(t.source==='payment'&&t.paymentHistoryId===historyEntry.id));
    }
    function refreshLinkedPaymentTransactions(payment){
      for(const historyEntry of payment.paymentHistory||[]){
        const linked=historyEntry.transactionId && state.transactions.some(t=>t.id===historyEntry.transactionId);
        if(linked) upsertPaymentTransaction(payment,historyEntry);
      }
    }
    function saveHouseholdPayment(e){
      e.preventDefault();
      const id=$('#paymentId').value||uid('pay');
      const existing=state.householdPayments.find(x=>x.id===id);
      const payment={
        id,
        title:$('#paymentTitle').value.trim(),
        category:$('#paymentCategory').value.trim(),
        amount:Math.max(0,number($('#paymentAmount').value)),
        frequency:['once','monthly','quarterly','yearly'].includes($('#paymentFrequency').value)?$('#paymentFrequency').value:'once',
        dueDate:$('#paymentDueDate').value,
        assignedTo:['me','partner','both'].includes($('#paymentAssignedTo').value)?$('#paymentAssignedTo').value:'both',
        automatic:!!$('#paymentAutomatic')?.checked,
        trackFinance:$('#paymentTrackFinance')?.checked!==false,
        status:existing?.status==='paid'?'paid':'pending',
        lastPaidAt:existing?.lastPaidAt||'',
        note:$('#paymentNote').value.trim(),
        shared:!!$('#paymentShared')?.checked,
        paymentHistory:Array.isArray(existing?.paymentHistory)?existing.paymentHistory:[],
        createdAt:existing?.createdAt||new Date().toISOString(),
        updatedAt:new Date().toISOString()
      };
      if(!payment.title || !/^\d{4}-\d{2}-\d{2}$/.test(payment.dueDate)){ toast('Vyplňte název a platný termín splatnosti.','warn'); return; }
      if(!(payment.amount>0)){ toast('Částka platby musí být vyšší než nula.','bad'); return; }
      if(payment.automatic && payment.status==='paid' && payment.frequency!=='once') payment.status='pending';
      if(existing){ Object.assign(existing,payment); refreshLinkedPaymentTransactions(existing); }
      else state.householdPayments.unshift(payment);
      const advanced=reconcileAutomaticHouseholdPayments();
      save(); resetHouseholdPaymentForm();
      toast(advanced?'Platba uložena, termín posunut a úhrada propsána do financí.':'Platba uložena.');
    }
    function resetHouseholdPaymentForm(){
      $('#paymentForm')?.reset();
      if($('#paymentId')) $('#paymentId').value='';
      if($('#paymentDueDate')) $('#paymentDueDate').value=today();
      if($('#paymentAssignedTo')) $('#paymentAssignedTo').value='both';
      if($('#paymentAutomatic')) $('#paymentAutomatic').checked=false;
      if($('#paymentTrackFinance')) $('#paymentTrackFinance').checked=true;
      if($('#paymentShared')) $('#paymentShared').checked=true;
    }
    function editHouseholdPayment(id){
      const payment=state.householdPayments.find(x=>x.id===id); if(!payment)return;
      showTab('payments'); toggleAddCard('paymentAddCard',true);
      $('#paymentId').value=payment.id; $('#paymentTitle').value=payment.title; $('#paymentCategory').value=payment.category||'';
      $('#paymentAmount').value=payment.amount||''; $('#paymentFrequency').value=payment.frequency||'once'; $('#paymentDueDate').value=payment.dueDate||today();
      $('#paymentAssignedTo').value=payment.assignedTo||'both'; $('#paymentAutomatic').checked=payment.automatic===true; if($('#paymentTrackFinance')) $('#paymentTrackFinance').checked=payment.trackFinance!==false; $('#paymentNote').value=payment.note||''; $('#paymentShared').checked=payment.shared!==false;
    }
    async function deleteHouseholdPayment(id){
      const payment=state.householdPayments.find(p=>p.id===id); if(!payment) return;
      const linkedIds=new Set((payment.paymentHistory||[]).map(h=>h.transactionId).filter(Boolean));
      const linkedCount=state.transactions.filter(t=>linkedIds.has(t.id)||(t.source==='payment'&&t.paymentId===id)).length;
      const message=linkedCount
        ? `Smazat závazek „${payment.title}“? Současně se odstraní ${linkedCount} propojených finančních ${linkedCount===1?'záznam':'záznamů'}, aby v bilanci nezůstaly osiřelé položky.`
        : `Smazat závazek „${payment.title}“?`;
      if(!await confirmDialog(message,{title:'Smazat účet nebo závazek',confirmText:'Smazat',danger:true})) return;
      state.householdPayments=state.householdPayments.filter(p=>p.id!==id);
      state.transactions=state.transactions.filter(t=>!linkedIds.has(t.id)&&!(t.source==='payment'&&t.paymentId===id));
      save(); toast('Závazek a jeho propojené finanční záznamy byly smazány.','warn');
    }
    function recordHouseholdPayment(id){
      const payment=state.householdPayments.find(x=>x.id===id); if(!payment)return;
      if(payment.automatic){ toast('Tato platba je automatická. Úhrada i finanční výdaj se zapíší ke dni splatnosti.','warn'); return; }
      if(payment.frequency==='once' && payment.status==='paid'){
        const historyIndex=(payment.paymentHistory||[]).findIndex(h=>!h.automatic && h.date===payment.lastPaidAt);
        if(historyIndex>=0){ removePaymentTransaction(payment.paymentHistory[historyIndex]); payment.paymentHistory.splice(historyIndex,1); }
        payment.status='pending'; payment.lastPaidAt=''; payment.updatedAt=new Date().toISOString(); save(); toast('Platba byla vrácena mezi neuhrazené a propojený výdaj odstraněn.','warn'); return;
      }
      if(!(number(payment.amount)>0)){ toast('Platbu s nulovou částkou nelze zaznamenat. Nejdříve ji upravte.','bad'); return; }
      const paidDate=today();
      payment.paymentHistory=Array.isArray(payment.paymentHistory)?payment.paymentHistory:[];
      const historyEntry={id:uid('hpay'),date:paidDate,amount:Math.max(0,number(payment.amount)),automatic:false,createdAt:new Date().toISOString()};
      payment.paymentHistory.unshift(historyEntry);
      payment.lastPaidAt=paidDate;
      if(payment.frequency==='once') payment.status='paid';
      else { payment.dueDate=nextPaymentDueDate(payment.dueDate,payment.frequency); payment.status='pending'; }
      upsertPaymentTransaction(payment,historyEntry);
      payment.updatedAt=new Date().toISOString();
      save();
      const linked=payment.trackFinance!==false?' Současně byl vytvořen výdaj v Příjmech a výdajích.':'';
      toast((payment.frequency==='once'?'Platba označena jako zaplacená.':'Platba zaznamenána a další termín byl posunut.')+linked);
    }
    function reconcileAutomaticHouseholdPayments(){
      let occurrences=0;
      for(const payment of state.householdPayments){
        const result=advanceAutomaticPayment(payment,today());
        if(!result.changed) continue;
        const existingHistory=Array.isArray(payment.paymentHistory)?payment.paymentHistory:[];
        const additions=result.occurrences.map(row=>({id:uid('hpay'),date:row.date,amount:row.amount,automatic:true,createdAt:new Date().toISOString()}));
        Object.assign(payment,result.payment,{paymentHistory:[...additions,...existingHistory],updatedAt:new Date().toISOString()});
        additions.forEach(historyEntry=>upsertPaymentTransaction(payment,historyEntry));
        occurrences+=additions.length;
      }
      return occurrences;
    }
    function paymentCardHtml(payment,{automatic=false}={}){
      const paid=payment.status==='paid';
      const overdueFlag=!automatic&&!paid&&payment.dueDate<today();
      const history=(payment.paymentHistory||[]).slice(0,20);
      const historyHtml=history.length?`<details class="history"><summary>Historie úhrad (${payment.paymentHistory.length})</summary><div class="history-list">${history.map(h=>`<div><span>${esc(fmtDate(`${h.date}T00:00:00`))}${h.automatic?' • automaticky':''}</span><strong>${fmt(h.amount)}</strong></div>`).join('')}</div></details>`:'';
      const timing=automatic?(paid?'automaticky uhrazeno':`další automatická úhrada ${fmtDate(`${payment.dueDate}T00:00:00`)}`):`splatnost ${fmtDate(`${payment.dueDate}T00:00:00`)}`;
      return `<article class="item"><div class="item-top"><div><h4>${paid?'✅ ':''}${esc(payment.title)}</h4><p><strong>${fmt(payment.amount)}</strong> • ${esc(paymentFrequencyLabel(payment.frequency))} • ${esc(timing)}</p>${payment.note?`<p>${esc(payment.note)}</p>`:''}<div class="meta"><span class="tag">${esc(payment.category||'bez kategorie')}</span><span class="tag">${esc(assignedToLabel(payment.assignedTo))}</span>${automatic?'<span class="tag auto-payment-tag">🏦 trvalý příkaz / inkaso</span>':''}${overdueFlag?'<span class="tag danger-tag">po splatnosti</span>':''}${payment.shared!==false?'<span class="tag">👥 sdílené</span>':'<span class="tag">🔒 soukromé</span>'}${payment.trackFinance!==false?'<span class="tag">🔗 zapisuje se do financí</span>':'<span class="tag">bez finančního zápisu</span>'}${payment.lastPaidAt?`<span class="tag">naposledy ${esc(fmtDate(`${payment.lastPaidAt}T00:00:00`))}</span>`:''}</div></div><div class="actions">${automatic?'':`<button class="mini-btn" data-pay-payment="${attr(payment.id)}" type="button">${paid?'Vrátit':'Zaplaceno'}</button>`}<button class="mini-btn" data-edit-payment="${attr(payment.id)}" type="button">Upravit</button><button class="mini-btn" data-delete-payment="${attr(payment.id)}" type="button">Smazat</button></div></div>${historyHtml}</article>`;
    }
    function renderHouseholdPayments(){
      const list=$('#paymentsList'), kpis=$('#paymentKpis'); if(!list||!kpis) return;
      const items=[...state.householdPayments].sort((a,b)=>(a.status==='paid'?1:0)-(b.status==='paid'?1:0)||String(a.dueDate).localeCompare(String(b.dueDate)));
      const manualOpen=items.filter(p=>!p.automatic&&p.status!=='paid');
      const manualPaid=items.filter(p=>!p.automatic&&p.status==='paid');
      const automaticItems=items.filter(p=>p.automatic&&!(p.frequency==='once'&&p.status==='paid'));
      const automaticPaidOnce=items.filter(p=>p.automatic&&p.frequency==='once'&&p.status==='paid');
      const overdue=manualOpen.filter(p=>p.dueDate<today());
      const recurringActive=items.filter(p=>p.status!=='paid'&&p.frequency!=='once');
      const monthlyRecurring=recurringActive.filter(p=>p.frequency==='monthly').reduce((sum,p)=>sum+number(p.amount),0);
      const activeInstallments=state.installments.map(i=>({i,c:computeInstallment(i)})).filter(row=>row.c.remaining>0);
      const installmentMonthly=activeInstallments.reduce((sum,row)=>sum+Math.min(Math.max(0,number(row.i.monthly)),row.c.remaining),0);
      const totalMonthlyCommitments=monthlyRecurring+installmentMonthly;
      const automaticAmount=automaticItems.reduce((sum,p)=>sum+number(p.amount),0);
      kpis.innerHTML=[
        kpi('K ruční úhradě',manualOpen.length,fmt(manualOpen.reduce((sum,p)=>sum+number(p.amount),0))),
        kpi('Po splatnosti',overdue.length,overdue.length?'Vyžaduje pozornost':'Vše v termínu'),
        kpi('Automatické platby',automaticItems.length,automaticItems.length?`${fmt(automaticAmount)} v evidenci`:'Žádné trvalé příkazy'),
        kpi('Měsíční závazky',fmt(totalMonthlyCommitments),`Účty ${fmt(monthlyRecurring)} + splátky ${fmt(installmentMonthly)}`)
      ].join('');
      const manualHtml=manualOpen.map(payment=>paymentCardHtml(payment)).join('')||empty('Nic nemusíte ručně odškrtávat. Všechny aktuální platby jsou automatické nebo již uhrazené.');
      const automaticHtml=automaticItems.map(payment=>paymentCardHtml(payment,{automatic:true})).join('')||empty('Zatím nejsou nastavené žádné automatické platby.');
      const paid=[...manualPaid,...automaticPaidOnce];
      const paidHtml=paid.length?`<details class="history"><summary>Historie uhrazených jednorázových plateb (${paid.length})</summary><div class="list mt-14">${paid.map(payment=>paymentCardHtml(payment,{automatic:payment.automatic===true})).join('')}</div></details>`:'';
      list.innerHTML=`<section class="payment-list-section"><div class="payment-section-head"><div><h4>Ruční úhrady</h4><p>Faktury a platby, které je potřeba skutečně potvrdit tlačítkem Zaplaceno.</p></div><span class="status ${overdue.length?'bad':'good'}">${manualOpen.length}</span></div>${manualHtml}</section><section class="payment-list-section"><div class="payment-section-head"><div><h4>Automaticky hrazeno</h4><p>Trvalé příkazy a inkasa se po termínu samy posunou na další období.</p></div><span class="status good">${automaticItems.length}</span></div>${automaticHtml}</section>${paidHtml}`;
    }

    // ===== Migrace starých potravin (shopping segment groceries → groceries) =====
    function migrateLegacyGroceries(target=state){
      if(!Array.isArray(target.shopping)) return 0;
      const legacy=target.shopping.filter(s=>s.segment==='groceries');
      if(!legacy.length) return 0;
      target.groceries=Array.isArray(target.groceries)?target.groceries:[];
      legacy.forEach(s=>{
        target.groceries.unshift({id:uid('groc'), name:String(s.name||'').slice(0,160), store:String(s.store||'').slice(0,60), note:String(s.note||'').slice(0,300), done:s.status==='bought', shared:true, createdAt:s.createdAt||new Date().toISOString(), updatedAt:new Date().toISOString()});
      });
      target.shopping=target.shopping.filter(s=>s.segment!=='groceries');
      return legacy.length;
    }

    // ===== Jídlo & benzín (měsíční rozpočet) =====
    function budgetLimits(){ return { food: state.settings.foodBudget===undefined?DEFAULT_FOOD_BUDGET:Math.max(0,number(state.settings.foodBudget)), fuel: state.settings.fuelBudget===undefined?DEFAULT_FUEL_BUDGET:Math.max(0,number(state.settings.fuelBudget)) }; }
    function saveBudgetEntry(e){e.preventDefault(); const id=$('#budgetId').value||uid('budget'); const existing=state.budgetEntries.find(x=>x.id===id); const b={id,date:$('#budgetDate').value,kind:$('#budgetKind').value==='fuel'?'fuel':'food',amount:Math.max(0,number($('#budgetAmount').value)),note:$('#budgetNote').value.trim(),shared:true,createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()}; if(!/^\d{4}-\d{2}-\d{2}$/.test(b.date)){toast('Zadejte platné datum útraty.','warn');return;} if(!(b.amount>0)){toast('Částka útraty musí být vyšší než nula.','bad');return;} if(existing)Object.assign(existing,b); else state.budgetEntries.unshift(b); save(); resetBudgetForm(); toast('Útrata uložena.');}
    function resetBudgetForm(){ $('#budgetForm').reset(); $('#budgetId').value=''; $('#budgetDate').value=today(); $('#budgetKind').value='food'; }
    function editBudgetForm(id){const b=state.budgetEntries.find(x=>x.id===id); if(!b)return; showTab('budget'); toggleAddCard('budgetAddCard',true); $('#budgetId').value=b.id; $('#budgetDate').value=b.date; $('#budgetKind').value=b.kind==='fuel'?'fuel':'food'; $('#budgetAmount').value=b.amount; $('#budgetNote').value=b.note||'';}
    function saveBudgetLimits(e){e.preventDefault(); state.settings.foodBudget=Math.max(0,number($('#budgetFoodLimit').value)); state.settings.fuelBudget=Math.max(0,number($('#budgetFuelLimit').value)); state.settings.familySettingsUpdatedAt=new Date().toISOString(); save(); toast('Měsíční limity uloženy.');}
    function renderBudget(){
      if(!$('#budgetKpis')) return;
      const month=$('#budgetMonth')?.value||monthNow();
      const year=Number($('#budgetYear')?.value)||currentYear();
      const limits=budgetLimits();
      const m=budgetMonthSummary(state.budgetEntries,month,limits);
      const foodCls=m.foodRemaining>=0?'money-plus':'money-minus';
      const fuelCls=m.fuelRemaining>=0?'money-plus':'money-minus';
      const balCls=m.balance>=0?'money-plus':'money-minus';
      $('#budgetKpis').innerHTML=[
        kpiHtml('🍞 Jídlo',`<span class="${foodCls}">${esc(fmt(m.food))}</span>`,`Limit ${fmt(m.foodLimit)} • ${m.foodRemaining>=0?'zbývá '+fmt(m.foodRemaining):'přes limit o '+fmt(-m.foodRemaining)}`),
        kpiHtml('⛽ Benzín',`<span class="${fuelCls}">${esc(fmt(m.fuel))}</span>`,`Limit ${fmt(m.fuelLimit)} • ${m.fuelRemaining>=0?'zbývá '+fmt(m.fuelRemaining):'přes limit o '+fmt(-m.fuelRemaining)}`),
        kpiHtml('Bilance měsíce',`<span class="${balCls}">${esc(fmt(m.balance))}</span>`,monthLabel(month)),
        kpi('Záznamy',m.count,monthLabel(month))
      ].join('');
      $('#budgetBars').innerHTML=[
        barRow('🍞 Jídlo',`${fmt(m.food)} / ${fmt(m.foodLimit)}`,m.foodLimit?m.food/m.foodLimit*100:0),
        barRow('⛽ Benzín',`${fmt(m.fuel)} / ${fmt(m.fuelLimit)}`,m.fuelLimit?m.fuel/m.fuelLimit*100:0)
      ].join('');
      const fl=$('#budgetFoodLimit'); if(fl && document.activeElement!==fl) fl.value=limits.food;
      const ul=$('#budgetFuelLimit'); if(ul && document.activeElement!==ul) ul.value=limits.fuel;
      renderBudgetChart(year,limits);
      const yd=budgetYearData(state.budgetEntries,year,limits).filter(d=>d.count>0);
      $('#budgetYearList').innerHTML=yd.map(d=>barRow(monthLabel(d.month),`${fmt(d.spent)} / ${fmt(d.limit)} (${d.balance>=0?'+':'−'}${fmt(Math.abs(d.balance))})`,d.limit?d.spent/d.limit*100:0)).join('')||empty(`V roce ${year} zatím nejsou žádné útraty.`);
      const arr=state.budgetEntries.filter(b=>String(b.date||'').startsWith(month)).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
      $('#budgetList').innerHTML=arr.map(b=>`<article class="item"><div class="item-top"><div><h4>${b.kind==='fuel'?'⛽ Benzín':'🍞 Jídlo'} • <span class="money-minus">${fmt(b.amount)}</span></h4><p>${esc(b.date)}${b.note?' • '+esc(b.note):''}</p></div><div class="actions"><button class="mini-btn" data-edit-budget="${attr(b.id)}" type="button">Upravit</button><button class="mini-btn" data-delete-budget="${attr(b.id)}" type="button">Smazat</button></div></div></article>`).join('')||empty('V tomto měsíci zatím nejsou útraty.');
    }
    function renderBudgetChart(year,limits){
      const el=$('#budgetChart'); if(!el) return;
      const data=budgetYearData(state.budgetEntries,year,limits);
      const maxSpend=Math.max(1,...data.flatMap(d=>[d.food,d.fuel]),limits.food,limits.fuel);
      const withEntries=data.filter(d=>d.count>0);
      const maxAbsBalance=Math.max(1,...withEntries.map(d=>Math.abs(d.balance)));
      const w=920,h=280,p=42,bar=17,gap=14;
      const chartTop=p, chartBottom=h-p;
      const barY=v=>chartBottom-(v/maxSpend)*(chartBottom-chartTop);
      const balanceZero=(chartTop+chartBottom)/2;
      const balanceY=v=>balanceZero-(v/maxAbsBalance)*((chartBottom-chartTop)/2);
      let svg=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Roční graf útrat za jídlo a benzín včetně bilance"><defs><linearGradient id="gBudFood" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#fbbf24"/><stop offset="1" stop-color="#f97316"/></linearGradient><linearGradient id="gBudFuel" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#38bdf8"/><stop offset="1" stop-color="#2563eb"/></linearGradient><linearGradient id="gBudBal" x1="0" x2="1"><stop stop-color="#33d69f"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs>`;
      for(let i=0;i<5;i++){const gy=chartTop+i*(chartBottom-chartTop)/4;svg+=`<line x1="${p}" y1="${gy}" x2="${w-p}" y2="${gy}" stroke="var(--chart-grid)"/><text x="4" y="${gy+4}" fill="var(--muted)" font-size="11">${Math.round(maxSpend*(1-i/4)).toLocaleString('cs-CZ')}</text>`;}
      svg+=`<line x1="${p}" y1="${balanceZero}" x2="${w-p}" y2="${balanceZero}" stroke="var(--muted-2)" stroke-dasharray="5 5"><title>Nulová osa bilance</title></line>`;
      const points=[];
      data.forEach((d,i)=>{
        const x=p+i*((w-p*2)/12)+gap;
        const fh=Math.max(2,chartBottom-barY(d.food));
        const uh=Math.max(2,chartBottom-barY(d.fuel));
        svg+=`<rect x="${x}" y="${chartBottom-fh}" width="${bar}" height="${fh}" rx="6" fill="url(#gBudFood)"><title>${monthLabel(d.month)}: jídlo ${fmt(d.food)}</title></rect>`;
        svg+=`<rect x="${x+bar+3}" y="${chartBottom-uh}" width="${bar}" height="${uh}" rx="6" fill="url(#gBudFuel)"><title>${monthLabel(d.month)}: benzín ${fmt(d.fuel)}</title></rect>`;
        const bal=d.count?d.balance:0;
        points.push(`${x+bar},${balanceY(bal)}`);
        svg+=`<text x="${x+bar}" y="${h-10}" text-anchor="middle" fill="var(--muted)" font-size="11">${i+1}</text>`;
      });
      svg+=`<polyline points="${points.join(' ')}" fill="none" stroke="url(#gBudBal)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
      data.forEach((d,i)=>{const [x,yv]=points[i].split(','); svg+=`<circle cx="${x}" cy="${yv}" r="4" fill="${(d.count?d.balance:0)>=0?'#ffffff':'#111827'}" stroke="#8b5cf6" stroke-width="3"><title>${monthLabel(d.month)}: ${d.count?'bilance '+fmt(d.balance):'bez záznamů'}</title></circle>`;});
      svg+=`<g transform="translate(${w-318},18)"><rect width="298" height="28" rx="14" fill="rgba(255,255,255,.07)"/><circle cx="18" cy="14" r="5" fill="#f97316"/><text x="30" y="18" fill="var(--muted)" font-size="12">jídlo</text><circle cx="100" cy="14" r="5" fill="#2563eb"/><text x="112" y="18" fill="var(--muted)" font-size="12">benzín</text><circle cx="188" cy="14" r="5" fill="#8b5cf6"/><text x="200" y="18" fill="var(--muted)" font-size="12">bilance +/−</text></g></svg>`;
      el.innerHTML=svg;
    }

    // ===== Nákupní seznam (běžné nákupy) =====
    function addGroceryItem(name, store){
      const clean=String(name||'').trim().slice(0,160);
      if(!clean) return false;
      state.groceries.unshift({id:uid('groc'), name:clean, store:String(store||'').slice(0,60), note:'', done:false, shared:true, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString()});
      return true;
    }
    function addGroceryQuick(e){
      e.preventDefault();
      if(!addGroceryItem($('#groceryName').value, $('#groceryStore').value)){ toast('Zadejte název položky.','warn'); return; }
      save();
      $('#groceryName').value='';
      $('#groceryName').focus();
    }
    function groceryBulkEntries(){
      return parseGroceryEntries($('#groceryBulkText')?.value||'', $('#groceryBulkStore')?.value||'');
    }
    function renderGroceryBulkPreview(){
      const preview=$('#groceryBulkPreview');
      const submit=$('#groceryBulkSubmit');
      if(!preview) return;
      const entries=groceryBulkEntries();
      if(!entries.length){
        preview.textContent='Vložte text a zobrazí se náhled položek.';
        if(submit) submit.textContent='Vložit položky';
        return;
      }
      const chips=entries.slice(0,12).map(item=>`<span class="grocery-preview-chip">${item.store?`🏬 ${esc(item.store)} · `:''}${esc(item.name)}</span>`).join('');
      const more=entries.length>12?`<span class="grocery-preview-chip">+ ${entries.length-12} dalších</span>`:'';
      preview.innerHTML=`<strong>Rozpoznáno ${entries.length} položek.</strong><div class="grocery-preview-chips">${chips}${more}</div>`;
      if(submit) submit.textContent=`Vložit ${entries.length} položek`;
    }
    function addGroceryBulk(e){
      e.preventDefault();
      const entries=groceryBulkEntries();
      if(!entries.length){ toast('Vložte alespoň jednu položku nákupního seznamu.','warn'); return; }
      const seen=new Set();
      const existing=new Set(state.groceries.filter(item=>!item.done).map(item=>`${strip(item.store||'')}|${strip(item.name||'')}`));
      const unique=[];
      let skipped=0;
      for(const item of entries){
        const key=`${strip(item.store||'')}|${strip(item.name||'')}`;
        if(seen.has(key)||existing.has(key)){ skipped++; continue; }
        seen.add(key); unique.push(item);
      }
      if(!unique.length){ toast('Všechny rozpoznané položky už v otevřeném seznamu jsou.','warn'); return; }
      [...unique].reverse().forEach(item=>addGroceryItem(item.name,item.store));
      save();
      $('#groceryBulkForm').reset();
      renderGroceryBulkPreview();
      toggleAddCard('groceryBulkCard', false);
      toast(`Přidáno ${unique.length} položek do nákupního seznamu.${skipped?` ${skipped} duplicit přeskočeno.`:''}`);
    }
    function toggleGroceryDone(id){ const g=state.groceries.find(x=>x.id===id); if(g){ g.done=!g.done; g.updatedAt=new Date().toISOString(); save(); } }
    async function clearBoughtGroceries(){
      const bought=state.groceries.filter(g=>g.done);
      if(!bought.length){ toast('Žádné koupené položky k vymazání.','warn'); return; }
      if(!await confirmDialog(`Odstranit ${bought.length} koupených položek ze seznamu?`, {title:'Vymazat koupené', confirmText:'Vymazat', danger:true})) return;
      state.groceries=state.groceries.filter(g=>!g.done);
      save();
      toast('Koupené položky odstraněny.','warn');
    }
    function groceryItemHtml(g, showStore=false){
      return `<div class="grocery-item${g.done?' done':''}"><input type="checkbox" data-toggle-grocery="${attr(g.id)}" ${g.done?'checked':''} aria-label="Označit ${attr(g.name)} jako koupené"><span class="g-name">${esc(g.name)}${showStore&&g.store?` <span class="g-note">· ${esc(g.store)}</span>`:''}</span><button class="mini-btn" data-delete-grocery="${attr(g.id)}" type="button">Smazat</button></div>`;
    }
    function renderGroceries(){
      const box=$('#groceryList'); if(!box) return;
      const open=state.groceries.filter(g=>!g.done);
      const done=state.groceries.filter(g=>g.done);
      const groups={};
      open.forEach(g=>{ const key=g.store||'Bez obchodu'; (groups[key]??=[]).push(g); });
      const keys=Object.keys(groups).sort((a,b)=>a.localeCompare(b,'cs'));
      let html=keys.map(k=>`<div class="grocery-group"><h4>🏬 ${esc(k)} <span class="g-note">(${groups[k].length})</span></h4>${groups[k].map(g=>groceryItemHtml(g)).join('')}</div>`).join('')||empty('Seznam je prázdný. Přidejte položku nahoře nebo vložte celý seznam najednou.');
      if(done.length) html+=`<details class="grocery-group"><summary>✅ Koupeno (${done.length})</summary><div class="spacer-12"></div>${done.map(g=>groceryItemHtml(g,true)).join('')}</details>`;
      box.innerHTML=html;
      renderGroceryPhotos();
    }

    // ===== Fotky nákupních seznamů (šifrované screenshoty) =====
    const groceryPhotoUrlCache=new Map();
    function releaseGroceryPhotoUrls(){ groceryPhotoUrlCache.forEach(url=>{ try{ URL.revokeObjectURL(url); }catch(e){} }); groceryPhotoUrlCache.clear(); }
    function groceryPhotoDocs(){ return state.documents.filter(d=>d.category==='nakup' && vaultDocStored(d)); }
    async function compressImage(file){
      const SMALL=600*1024;
      if(!file || !String(file.type||'').startsWith('image/') || file.size<=SMALL) return file;
      try{
        const bmp=await createImageBitmap(file);
        const MAXDIM=1600;
        const scale=Math.min(1, MAXDIM/Math.max(bmp.width,bmp.height));
        const cw=Math.max(1,Math.round(bmp.width*scale)), ch=Math.max(1,Math.round(bmp.height*scale));
        const canvas=document.createElement('canvas'); canvas.width=cw; canvas.height=ch;
        canvas.getContext('2d').drawImage(bmp,0,0,cw,ch);
        try{ bmp.close(); }catch(e){}
        const blob=await new Promise(res=>canvas.toBlob(res,'image/jpeg',0.82));
        if(!blob || blob.size>=file.size) return file;
        const base=String(file.name||'nakupni-seznam').replace(/\.[a-z0-9]+$/i,'');
        try{ return new File([blob], `${base}.jpg`, {type:'image/jpeg'}); }
        catch(e){ blob.name=`${base}.jpg`; return blob; }
      }catch(err){ console.warn('Komprese obrázku selhala, ukládám originál.', err); return file; }
    }
    async function addGroceryPhoto(e){
      const file=e.target.files?.[0];
      e.target.value='';
      if(!file) return;
      if(!String(file.type||'').startsWith('image/')){ toast('Vyberte obrázek (screenshot nebo fotku).','warn'); return; }
      try{
        const compressed=await compressImage(file);
        if(compressed.size > MAX_COMPLETE_BACKUP_FILE_BYTES){ toast(`Obrázek je i po zmenšení příliš velký. Maximum je ${formatBytes(MAX_COMPLETE_BACKUP_FILE_BYTES)}.`,'bad'); return; }
        await assertStorageHeadroom(compressed.size);
        const id=uid('doc');
        await idbPut(id, compressed, VAULT_STORE);
        state.documents=[{id, title:`Nákupní seznam ${today()}`, category:'nakup', date:today(), note:'', fileName:compressed.name||file.name||'nakupni-seznam.jpg', mime:compressed.type||'image/jpeg', size:compressed.size, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(), storedFile:true, encrypted:!!vaultKey}, ...state.documents];
        save();
        toast('Fotka seznamu uložena do šifrovaného trezoru.');
      }catch(err){ console.error(err); toast('Fotku se nepodařilo uložit: '+(err.message||err),'bad'); }
    }
    async function groceryPhotoUrl(id){
      if(groceryPhotoUrlCache.has(id)) return groceryPhotoUrlCache.get(id);
      const file=await idbGet(id, VAULT_STORE);
      if(!file) return '';
      const url=URL.createObjectURL(file);
      groceryPhotoUrlCache.set(id,url);
      return url;
    }
    async function renderGroceryPhotos(){
      const grid=$('#groceryPhotoGrid'); if(!grid) return;
      const docs=groceryPhotoDocs();
      if(!docs.length){ grid.innerHTML=empty('Zatím žádné uložené screenshoty seznamů.'); return; }
      grid.innerHTML=docs.map(d=>`<figure class="photo-thumb"><img data-view-gphoto="${attr(d.id)}" data-photo-id="${attr(d.id)}" alt="${attr(d.title||'Nákupní seznam')}" loading="lazy"><div class="photo-meta"><span>${esc(d.date||'')}</span><button class="mini-btn" data-delete-gphoto="${attr(d.id)}" type="button">Smazat</button></div></figure>`).join('');
      for(const d of docs){
        try{
          const url=await groceryPhotoUrl(d.id);
          const img=grid.querySelector(`img[data-photo-id="${CSS.escape(d.id)}"]`);
          if(img && url) img.src=url;
        }catch(err){ console.warn(err); }
      }
    }
    async function viewGroceryPhoto(id){
      try{
        const url=await groceryPhotoUrl(id);
        if(!url){ toast('Obrázek nebyl nalezen v lokálním úložišti.','bad'); return; }
        const meta=state.documents.find(d=>d.id===id);
        openDetailModal(meta?.title||'Nákupní seznam', `<img class="photo-full" src="${attr(url)}" alt="${attr(meta?.title||'Nákupní seznam')}">`);
      }catch(err){ console.error(err); toast('Obrázek se nepodařilo zobrazit.','bad'); }
    }
    async function deleteGroceryPhoto(id){
      if(!await confirmDialog('Smazat tuto fotku seznamu ze šifrovaného trezoru?', {title:'Smazat fotku', confirmText:'Smazat', danger:true})) return;
      try{ await idbDelete(id, VAULT_STORE); }catch(err){ console.warn(err); }
      const url=groceryPhotoUrlCache.get(id);
      if(url){ try{ URL.revokeObjectURL(url); }catch(e){} groceryPhotoUrlCache.delete(id); }
      state.documents=state.documents.filter(d=>d.id!==id);
      save();
      toast('Fotka seznamu smazána.','warn');
    }

    // ===== AI výkaz (evidence času pro měsíční výkaz) =====
    function isAiMonthClosed(month){ return (state.aiClosedMonths||[]).some(c=>c.month===month); }
    function saveAiEntry(e){
      e.preventDefault();
      const id=$('#aiId').value||uid('ai');
      const existing=state.aiEntries.find(x=>x.id===id);
      const a={id, date:$('#aiDate').value, minutes:Math.min(1440,Math.max(1,Math.round(number($('#aiMinutes').value)))), activity:$('#aiActivity').value.trim(), note:$('#aiNote').value.trim(), createdAt:existing?.createdAt||new Date().toISOString(), updatedAt:new Date().toISOString()};
      if(!/^\d{4}-\d{2}-\d{2}$/.test(a.date)||!a.activity){ toast('Zadejte datum a popis činnosti.','warn'); return; }
      if(isAiMonthClosed(a.date.slice(0,7))){ toast(`Měsíc ${monthLabel(a.date.slice(0,7))} je uzavřen. Nejdřív ho znovu otevřete tlačítkem u záznamů.`,'warn'); return; }
      if(existing)Object.assign(existing,a); else state.aiEntries.unshift(a);
      save(); resetAiForm(); toast('Záznam do AI výkazu uložen.');
    }
    function resetAiForm(){ $('#aiForm').reset(); $('#aiId').value=''; $('#aiDate').value=today(); }
    function editAiForm(id){const a=state.aiEntries.find(x=>x.id===id); if(!a)return; if(isAiMonthClosed(String(a.date||'').slice(0,7))){ toast('Měsíc je uzavřen – pro úpravy ho nejdřív znovu otevřete.','warn'); return; } showTab('ailog'); toggleAddCard('aiAddCard',true); $('#aiId').value=a.id; $('#aiDate').value=a.date; $('#aiMinutes').value=a.minutes; $('#aiActivity').value=a.activity; $('#aiNote').value=a.note||'';}
    async function toggleAiMonthClosed(){
      const month=$('#aiMonth')?.value||monthNow();
      if(isAiMonthClosed(month)){
        if(!await confirmDialog(`Znovu otevřít měsíc ${monthLabel(month)} pro úpravy záznamů?`, {title:'Otevřít měsíc', confirmText:'Otevřít'})) return;
        state.aiClosedMonths=state.aiClosedMonths.filter(c=>c.month!==month);
        save(); toast(`Měsíc ${monthLabel(month)} znovu otevřen.`);
      }else{
        if(!await confirmDialog(`Uzavřít měsíc ${monthLabel(month)}? Záznamy pak nepůjde přidávat ani upravovat, dokud měsíc znovu neotevřete. Po uzavření vygenerujte PDF výkaz.`, {title:'Uzavřít měsíc', confirmText:'Uzavřít'})) return;
        state.aiClosedMonths.unshift({month, closedAt:new Date().toISOString()});
        save(); toast(`Měsíc ${monthLabel(month)} uzavřen. Nyní můžete vygenerovat PDF výkaz.`);
      }
    }
    function renderAiLog(){
      if(!$('#aiKpis')) return;
      const month=$('#aiMonth')?.value||monthNow();
      const year=month.slice(0,4);
      const monthMin=sumMinutes(state.aiEntries,month);
      const yearMin=sumMinutes(state.aiEntries,year);
      const entries=state.aiEntries.filter(a=>String(a.date||'').startsWith(month)).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
      const closed=isAiMonthClosed(month);
      $('#aiKpis').innerHTML=[
        kpi('Tento měsíc',minutesLabel(monthMin),monthLabel(month)),
        kpi('Záznamů',entries.length,monthLabel(month)),
        kpi(`Za rok ${year}`,minutesLabel(yearMin),'Celkový čas nad AI'),
        kpiHtml('Stav měsíce', closed?'<span class="money-minus">Uzavřeno</span>':'<span class="money-plus">Otevřeno</span>', closed?'Pro úpravy měsíc znovu otevřete':'Záznamy lze přidávat')
      ].join('');
      const closeBtn=$('#aiCloseBtn'); if(closeBtn) closeBtn.textContent=closed?'Otevřít měsíc':'Uzavřít měsíc';
      renderAiChart(year);
      $('#aiList').innerHTML=entries.map(a=>`<article class="item"><div class="item-top"><div><h4>${esc(a.activity)}</h4><p>${esc(a.date)} • <strong>${minutesLabel(a.minutes)}</strong></p>${a.note?`<p>${esc(a.note)}</p>`:''}</div><div class="actions">${closed?'':`<button class="mini-btn" data-edit-ai="${attr(a.id)}" type="button">Upravit</button><button class="mini-btn" data-delete-ai="${attr(a.id)}" type="button">Smazat</button>`}</div></div></article>`).join('')||empty('V tomto měsíci zatím nejsou záznamy. Zapisujte průběžně – na konci měsíce z nich vznikne výkaz.');
    }
    function renderAiChart(year){
      const el=$('#aiChart'); if(!el) return;
      const months=Array.from({length:12},(_,i)=>`${year}-${pad(i+1)}`);
      const values=months.map(m=>sumMinutes(state.aiEntries,m));
      const max=Math.max(60,...values);
      const w=760,h=250,p=34;
      let svg=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Čas strávený prací s AI po měsících"><defs><linearGradient id="gAi" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#6ee7ff"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs>`;
      for(let i=0;i<5;i++){const gy=p+i*(h-p*2)/4;svg+=`<line x1="${p}" y1="${gy}" x2="${w-p}" y2="${gy}" stroke="var(--chart-grid)"/>`;}
      values.forEach((v,i)=>{const x=p+i*((w-p*2)/12)+12,bw=32,bh=Math.max(2,(v/max)*(h-p*2));svg+=`<rect x="${x}" y="${h-p-bh}" width="${bw}" height="${bh}" rx="9" fill="url(#gAi)"><title>${monthLabel(months[i])}: ${minutesLabel(v)}</title></rect><text x="${x+bw/2}" y="${h-10}" text-anchor="middle" fill="var(--muted)" font-size="11">${i+1}</text>`;});
      svg+='</svg>';
      el.innerHTML=svg;
    }

    // ===== Odměny (školní rok: září–prosinec / leden–červen) =====
    function fmtHours(h){ return `${(Number(h)||0).toLocaleString('cs-CZ',{maximumFractionDigits:1})} h`; }
    function rewardPeriodSortKey(period){
      const m=/^(\d{4})-(\d{4})-(A|B)$/.exec(normalizeRewardPeriod(period));
      return m ? Number(m[1])*2+(m[3]==='B'?1:0) : -1;
    }
    function populateRewardPeriodSelects(){
      const now=new Date();
      const currentSchoolStart=now.getMonth()+1>=9?now.getFullYear():now.getFullYear()-1;
      const base=[];
      for(let startYear=currentSchoolStart-1;startYear<=currentSchoolStart+1;startYear++){
        base.push(`${startYear}-${startYear+1}-A`,`${startYear}-${startYear+1}-B`);
      }
      state.rewards.forEach(r=>{ r.period=normalizeRewardPeriod(r.period); });
      const set=new Set([...base,...state.rewards.map(r=>r.period)]);
      const list=[...set].filter(p=>/^\d{4}-\d{4}-(A|B)$/.test(p)).sort((a,b)=>rewardPeriodSortKey(b)-rewardPeriodSortKey(a));
      const cur=currentRewardPeriod();
      ['rewardPeriodSelect','rewardPeriod'].forEach(id=>{
        const sel=document.getElementById(id); if(!sel) return;
        const old=normalizeRewardPeriod(sel.value);
        sel.innerHTML=list.map(p=>`<option value="${attr(p)}">${esc(rewardPeriodLabel(p))}</option>`).join('');
        sel.value=list.includes(old)?old:(list.includes(cur)?cur:(list[0]||''));
      });
    }
    function selectedRewardPeriod(){ return normalizeRewardPeriod($('#rewardPeriodSelect')?.value || currentRewardPeriod()); }
    function saveReward(e){
      e.preventDefault();
      const id=$('#rewardId').value||uid('rew');
      const existing=state.rewards.find(x=>x.id===id);
      const r={id, period:normalizeRewardPeriod($('#rewardPeriod').value), hours:Math.max(0,number($('#rewardHours').value)), title:$('#rewardTitle').value.trim(), note:$('#rewardNote').value.trim(), createdAt:existing?.createdAt||new Date().toISOString(), updatedAt:new Date().toISOString()};
      if(!/^\d{4}-\d{4}-(A|B)$/.test(r.period)||!r.title){ toast('Vyplňte školní období a popis činnosti.','warn'); return; }
      if(existing)Object.assign(existing,r); else state.rewards.unshift(r);
      save(); populateRewardPeriodSelects(); resetRewardForm(); toast('Položka odměn uložena a zůstává kdykoli upravitelná.');
    }
    function resetRewardForm(){ $('#rewardForm').reset(); $('#rewardId').value=''; const sel=$('#rewardPeriod'); if(sel) sel.value=selectedRewardPeriod(); }
    function editRewardForm(id){const r=state.rewards.find(x=>x.id===id); if(!r)return; showTab('rewards'); toggleAddCard('rewardAddCard',true); $('#rewardId').value=r.id; $('#rewardPeriod').value=normalizeRewardPeriod(r.period); $('#rewardHours').value=r.hours; $('#rewardTitle').value=r.title; $('#rewardNote').value=r.note||'';}
    function renderRewards(){
      if(!$('#rewardKpis')) return;
      const period=selectedRewardPeriod();
      const items=state.rewards.filter(r=>normalizeRewardPeriod(r.period)===period).sort((a,b)=>String(b.updatedAt||b.createdAt).localeCompare(String(a.updatedAt||a.createdAt)));
      const hours=items.reduce((sum,r)=>sum+Math.max(0,number(r.hours)),0);
      const allHours=state.rewards.reduce((a,r)=>a+Math.max(0,number(r.hours)),0);
      $('#rewardKpis').innerHTML=[
        kpi('Hodin v období',fmtHours(hours),rewardPeriodLabel(period)),
        kpi('Průběžných položek',items.length,'Každou lze kdykoli upravit'),
        kpi('Hodin celkem',fmtHours(allHours),'Napříč všemi školními obdobími'),
        kpi('Aktuální období',rewardPeriodLabel(currentRewardPeriod()),'Dvě období za školní rok')
      ].join('');
      $('#rewardList').innerHTML=items.map(r=>`<article class="item"><div class="item-top"><div><h4>${esc(r.title)}</h4><p><strong>${fmtHours(r.hours)}</strong> • ${esc(rewardPeriodLabel(r.period))}</p>${r.note?`<p>${esc(r.note)}</p>`:''}<p class="small">Aktualizováno ${esc(fmtDate(r.updatedAt||r.createdAt))}</p></div><div class="actions"><button class="mini-btn" data-edit-reward="${attr(r.id)}" type="button">Upravit</button><button class="mini-btn" data-delete-reward="${attr(r.id)}" type="button">Smazat</button></div></div></article>`).join('')||empty('V tomto období zatím nejsou položky. Přidávejte je průběžně během celého období.');
    }

    // ===== Zahrada (pořízení + deník údržby) =====
    const GARDEN_TYPES = {hnojeni:'🌿 Hnojení', vertikutace:'🪒 Vertikutace', aerifikace:'🕳️ Aerifikace', dosev:'🌾 Dosev', postrik:'💧 Postřik', sekani:'✂️ Sekání', zavlaha:'🚿 Závlaha', servis:'🔧 Servis techniky', jine:'📌 Jiné'};
    function gardenTypeLabel(t){ return GARDEN_TYPES[t] || GARDEN_TYPES.jine; }
    function gardenHorizonLabel(h){ return {now:'Co nejdřív', season:'Tuto sezónu', year:'Do roka', someday:'Někdy'}[h] || 'Někdy'; }
    function saveGardenItem(e){
      e.preventDefault();
      const id=$('#gardenItemId').value||uid('gitem');
      const existing=state.gardenItems.find(x=>x.id===id);
      const g={id, name:$('#gardenItemName').value.trim(), price:Math.max(0,number($('#gardenItemPrice').value)), horizon:['now','season','year','someday'].includes($('#gardenItemHorizon').value)?$('#gardenItemHorizon').value:'season', url:safeUrl($('#gardenItemUrl').value), note:$('#gardenItemNote').value.trim(), done:existing?.done||false, shared:!!$('#gardenItemShared')?.checked, createdAt:existing?.createdAt||new Date().toISOString(), updatedAt:new Date().toISOString()};
      if(!g.name){ toast('Zadejte, co je potřeba pořídit.','warn'); return; }
      if(existing)Object.assign(existing,g); else state.gardenItems.unshift(g);
      save(); resetGardenItemForm(); toast('Položka na zahradu uložena.');
    }
    function resetGardenItemForm(){ $('#gardenItemForm').reset(); $('#gardenItemId').value=''; if($('#gardenItemShared')) $('#gardenItemShared').checked=true; }
    function editGardenItemForm(id){const g=state.gardenItems.find(x=>x.id===id); if(!g)return; showTab('garden'); toggleAddCard('gardenItemAddCard',true); $('#gardenItemId').value=g.id; $('#gardenItemName').value=g.name; $('#gardenItemPrice').value=g.price||''; $('#gardenItemHorizon').value=g.horizon||'season'; $('#gardenItemUrl').value=g.url||''; $('#gardenItemNote').value=g.note||''; if($('#gardenItemShared')) $('#gardenItemShared').checked=g.shared!==false;}
    function toggleGardenItemDone(id){ const g=state.gardenItems.find(x=>x.id===id); if(g){ g.done=!g.done; g.updatedAt=new Date().toISOString(); save(); toast(g.done?'Označeno jako pořízené. 🌱':'Vráceno mezi plánované.'); } }
    function saveGardenLog(e){
      e.preventDefault();
      const id=$('#gardenLogId').value||uid('glog');
      const existing=state.gardenLogs.find(x=>x.id===id);
      const g={id, date:$('#gardenLogDate').value, type:Object.prototype.hasOwnProperty.call(GARDEN_TYPES,$('#gardenLogType').value)?$('#gardenLogType').value:'jine', area:$('#gardenLogArea').value.trim(), note:$('#gardenLogNote').value.trim(), shared:!!$('#gardenLogShared')?.checked, createdAt:existing?.createdAt||new Date().toISOString(), updatedAt:new Date().toISOString()};
      if(!/^\d{4}-\d{2}-\d{2}$/.test(g.date)){ toast('Zadejte platné datum údržby.','warn'); return; }
      if(existing)Object.assign(existing,g); else state.gardenLogs.unshift(g);
      save(); resetGardenLogForm(); toast('Záznam údržby uložen.');
    }
    function resetGardenLogForm(){ $('#gardenLogForm').reset(); $('#gardenLogId').value=''; $('#gardenLogDate').value=today(); if($('#gardenLogShared')) $('#gardenLogShared').checked=true; }
    function editGardenLogForm(id){const g=state.gardenLogs.find(x=>x.id===id); if(!g)return; showTab('garden'); toggleAddCard('gardenLogAddCard',true); $('#gardenLogId').value=g.id; $('#gardenLogDate').value=g.date; $('#gardenLogType').value=g.type||'jine'; $('#gardenLogArea').value=g.area||''; $('#gardenLogNote').value=g.note||''; if($('#gardenLogShared')) $('#gardenLogShared').checked=g.shared!==false;}
    function lastGardenLogOfType(type){ return state.gardenLogs.filter(g=>g.type===type).sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0]||null; }
    function renderGarden(){
      if(!$('#gardenKpis')) return;
      const open=state.gardenItems.filter(g=>!g.done);
      const openSum=open.reduce((a,g)=>a+number(g.price),0);
      const doneCount=state.gardenItems.filter(g=>g.done).length;
      const lastFert=lastGardenLogOfType('hnojeni');
      const lastServis=lastGardenLogOfType('servis');
      $('#gardenKpis').innerHTML=[
        kpi('K pořízení',open.length,`Odhad ${fmt(openSum)}`),
        kpi('Pořízeno',doneCount,'Odškrtnuté položky'),
        kpi('Poslední hnojení',lastFert?fmtDate(`${lastFert.date}T00:00:00`):'—',lastFert?.area||'Zatím bez záznamu'),
        kpi('Poslední servis',lastServis?fmtDate(`${lastServis.date}T00:00:00`):'—',lastServis?.area||'Zatím bez záznamu')
      ].join('');
      // Přehled „kdy naposledy" podle typu údržby
      const careTypes=['hnojeni','vertikutace','aerifikace','dosev','postrik','sekani','zavlaha','servis'];
      $('#gardenCare').innerHTML=careTypes.map(t=>{
        const last=lastGardenLogOfType(t);
        if(!last) return barRow(gardenTypeLabel(t),'zatím žádný záznam',0);
        const days=Math.max(0,daysSince(`${last.date}T12:00:00`)??0);
        const fresh=Math.max(4,100-days*100/180);
        return barRow(gardenTypeLabel(t), `${fmtDate(`${last.date}T00:00:00`)} • před ${days} dny${last.area?' • '+esc(last.area):''}`, fresh);
      }).join('');
      // Aktivní položky zůstávají viditelné, pořízené se přesouvají do rozbalovacího archivu.
      const horizonOrder={now:0,season:1,year:2,someday:3};
      const openItems=state.gardenItems.filter(g=>!g.done).sort((a,b)=>horizonOrder[a.horizon]-horizonOrder[b.horizon] || String(b.createdAt).localeCompare(String(a.createdAt)));
      const completedItems=state.gardenItems.filter(g=>g.done).sort((a,b)=>String(b.updatedAt||b.createdAt).localeCompare(String(a.updatedAt||a.createdAt)));
      const gardenItemCard=(g,completed=false)=>`<article class="task ${completed?'done':''}"><div class="checkline"><input type="checkbox" data-toggle-gitem="${attr(g.id)}" ${completed?'checked':''} aria-label="Označit ${attr(g.name)} jako pořízené"><div><h4>${esc(g.name)}</h4><p>${g.price?`<strong>${fmt(g.price)}</strong> • `:''}${gardenHorizonLabel(g.horizon)}</p>${g.note?`<p>${esc(g.note)}</p>`:''}<div class="meta">${g.url?`<a class="tag" href="${attr(safeUrl(g.url))}" target="_blank" rel="noopener">odkaz ↗</a>`:''}${completed?'<span class="tag">✅ pořízeno</span>':''}</div></div></div><div class="actions"><button class="mini-btn" data-edit-gitem="${attr(g.id)}" type="button">Upravit</button><button class="mini-btn" data-delete-gitem="${attr(g.id)}" type="button">Smazat</button></div></div></article>`;
      $('#gardenItemsList').innerHTML=openItems.map(g=>gardenItemCard(g,false)).join('')||empty('Všechny položky jsou pořízené. Novou věc přidáte plovoucím tlačítkem +.');
      const completedCount=$('#gardenCompletedCount'); if(completedCount) completedCount.textContent=String(completedItems.length);
      const completedList=$('#gardenCompletedList'); if(completedList) completedList.innerHTML=completedItems.map(g=>gardenItemCard(g,true)).join('')||empty('Archiv pořízených položek je prázdný.');
      const completedArchive=$('#gardenCompletedArchive'); if(completedArchive) completedArchive.hidden=!completedItems.length;
      // Deník údržby
      const filter=$('#gardenLogFilter')?.value||'all';
      const logs=[...state.gardenLogs].filter(g=>filter==='all'||g.type===filter).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
      $('#gardenLogList').innerHTML=logs.map(g=>`<article class="item"><div class="item-top"><div><h4>${gardenTypeLabel(g.type)}${g.area?` • ${esc(g.area)}`:''}</h4><p>${esc(fmtDate(`${g.date}T00:00:00`))}</p>${g.note?`<p>${esc(g.note)}</p>`:''}</div><div class="actions"><button class="mini-btn" data-edit-glog="${attr(g.id)}" type="button">Upravit</button><button class="mini-btn" data-delete-glog="${attr(g.id)}" type="button">Smazat</button></div></div></article>`).join('')||empty(filter==='all'?'Deník je prázdný. Zapište první hnojení, vertikutaci nebo servis.':'Pro tento typ zatím nejsou záznamy.');
    }

    // ===== Rodina (šifrovaný náhled partnerových sdílených dat) =====
    function cloneFamilyValue(value){ return JSON.parse(JSON.stringify(value)); }
    function legacyFamilyId(prefix,value){
      const input=JSON.stringify(value||{}); let hash=2166136261;
      for(let i=0;i<input.length;i++){ hash^=input.charCodeAt(i); hash=Math.imul(hash,16777619); }
      return `${prefix}_legacy_${(hash>>>0).toString(36)}`;
    }
    function ensureFamilyIdentity(){
      let changed=false;
      if(!state.settings.familyMemberId){ state.settings.familyMemberId=uid('member'); changed=true; }
      if(!state.settings.familySettingsUpdatedAt){ state.settings.familySettingsUpdatedAt=state.updatedAt||new Date().toISOString(); changed=true; }
      return changed ? save(false) : Promise.resolve(true);
    }
    function buildPartnerSharePayload(){
      const name=(state.settings.familyDisplayName||'').trim()||reportOwner().name||(state.settings.greetName||'').trim()||'Partner';
      return buildFamilySnapshot({state,version:VERSION,ownerId:state.settings.familyMemberId,ownerName:name});
    }
    async function deliverPartnerShareFile(encrypted){
      const baseName=`lifehub-rodina-${today()}`;
      const downloadFileName=`${baseName}.lifehub-family`;
      const shareFileName=`${baseName}.lifehub-family.txt`;
      const content=JSON.stringify(encrypted,null,2);
      const downloadMime='application/octet-stream';
      const shareMime='text/plain;charset=utf-8';
      const downloadBlob=new Blob([content],{type:downloadMime});
      const shareBlob=new Blob([content],{type:shareMime});
      let shareFile=null;
      let shareData=null;
      try{
        shareFile=new File([shareBlob],shareFileName,{type:shareMime,lastModified:Date.now()});
        shareData={files:[shareFile]};
      }catch(err){
        console.warn('Prohlížeč neumí vytvořit sdílený File objekt.',err);
      }

      let canShare=false;
      try{
        canShare=!!shareData && typeof navigator.share==='function' &&
          (typeof navigator.canShare!=='function' || navigator.canShare(shareData));
      }catch(err){ console.warn('Kontrola systémového sdílení selhala.',err); }

      if(canShare){
        const action=await choiceDialog({
          title:'Rodinný soubor je připraven',
          message:'Pro WhatsApp se soubor odešle jako kompatibilní textový dokument. Obsah zůstává zašifrovaný a LifeHub ho umí načíst stejně jako soubor .lifehub-family.',
          choices:[
            {value:'share',text:'Sdílet přes WhatsApp…',className:'btn primary',autofocus:true},
            {value:'download',text:'Stáhnout do zařízení',className:'btn'},
            {value:null,text:'Zrušit',className:'btn'}
          ]
        });
        if(!action) return false;
        if(action==='share'){
          try{
            await navigator.share(shareData);
            toast('Soubor byl předán systémové nabídce sdílení. Vyberte WhatsApp.','good');
            return true;
          }catch(err){
            if(err?.name==='AbortError') return false;
            const detail=[err?.name,err?.message].filter(Boolean).join(': ');
            console.warn('Systémové sdílení selhalo, používám stažení.',err);
            download(downloadFileName,downloadBlob,downloadMime);
            toast(`Sdílení selhalo${detail?` (${detail})`:''}. Soubor byl stažen do zařízení.`,'warn');
            return true;
          }
        }
      }

      download(downloadFileName,downloadBlob,downloadMime);
      toast('Tento prohlížeč neumí bezpečně sdílet soubor přímo. Soubor byl stažen do zařízení.','warn');
      return true;
    }

    async function exportPartnerShare(){
      try{
        if(!await ensureFamilyIdentity()){
          toast('Rodinný soubor nelze vytvořit, dokud se nepodaří bezpečně uložit identitu tohoto zařízení.', 'bad');
          return;
        }
        const payload=buildPartnerSharePayload();
        const summary=summarizeFamilySnapshot(payload);
        const labels={transactions:'sdílené transakce',budgetEntries:'útraty za jídlo a benzín',groceries:'nákupní seznam',tasks:'úkoly',shopping:'velké nákupy',installments:'splátky',householdPayments:'platby domácnosti',gardenItems:'zahradní nákupy',gardenLogs:'zahradní deník'};
        const included=FAMILY_COLLECTIONS.filter(key=>summary.counts[key]>0).map(key=>`- ${labels[key]}: ${summary.counts[key]}`).join('\n') || '- žádné sdílené položky';
        const confirmed=await confirmDialog(`Rodinný soubor bude pouze pro čtení a zahrne celkem ${summary.total} sdílených položek:
${included}

${FAMILY_EXCLUDED_DESCRIPTION}

Pokračovat ve vytvoření šifrovaného souboru?`,{title:'Obsah rodinného souboru',confirmText:'Vytvořit rodinný soubor'});
        if(!confirmed) return;
        let credentials=String(state.settings.familyPassword||'');
        if(credentials.length < MIN_PASSWORD_LENGTH) credentials=await setFamilyPassword();
        if(!credentials) return;
        const encrypted=await encryptBackupObject(payload,credentials,VERSION);
        encrypted.contentType='family-snapshot';
        encrypted.familySchema=3;
        await deliverPartnerShareFile(encrypted);
      }catch(err){ console.error(err); toast('Rodinný soubor se nepodařilo vytvořit: '+(err.message||err),'bad'); }
    }
    function normalizeLegacyFamilyPayload(raw){
      const exportedAt=textLimit(raw?.exportedAt,40)||new Date().toISOString();
      const ownerName=textLimit(raw?.owner?.name||raw?.name,60)||'Partner';
      const d=raw?.data&&typeof raw.data==='object'?raw.data:{};
      const stamp=(prefix,item)=>({id:legacyFamilyId(prefix,{ownerName,item}),shared:true,createdAt:exportedAt,updatedAt:exportedAt,...item});
      return {
        kind:'LifeHub family snapshot',schema:1,version:textLimit(raw?.version,30),exportedAt,
        owner:{id:legacyFamilyId('member',{ownerName}),name:ownerName},householdSettings:null,
        data:{
          transactions:[],budgetEntries:[],householdPayments:[],gardenLogs:[],
          groceries:(Array.isArray(d.groceries)?d.groceries:[]).map(x=>stamp('groc',x)),
          tasks:(Array.isArray(d.tasks)?d.tasks:[]).map(x=>stamp('task',x)),
          shopping:(Array.isArray(d.shopping)?d.shopping:[]).map(x=>stamp('shop',x)),
          installments:(Array.isArray(d.installments)?d.installments:[]).map(x=>stamp('inst',x)),
          gardenItems:(Array.isArray(d.gardenItems)?d.gardenItems:[]).map(x=>stamp('gitem',x))
        }
      };
    }
    function sanitizeFamilyPayload(raw){
      if(!raw||typeof raw!=='object'||Array.isArray(raw)) throw new Error('Rodinný soubor nemá očekávaný formát.');
      if(raw.kind==='LifeHub partner share') raw=normalizeLegacyFamilyPayload(raw);
      if(!['LifeHub family snapshot','LifeHub family sync'].includes(raw.kind)) throw new Error('Toto není podporovaný rodinný náhled LifeHubu.');
      const d=raw.data&&typeof raw.data==='object'&&!Array.isArray(raw.data)?raw.data:{};
      const hs=raw.householdSettings&&typeof raw.householdSettings==='object'?raw.householdSettings:{};
      const sanitized=sanitizeImportedState({
        settings:{foodBudget:hs.foodBudget,fuelBudget:hs.fuelBudget,savingGoal:hs.savingGoal,familySettingsUpdatedAt:hs.updatedAt},
        transactions:d.transactions,budgetEntries:d.budgetEntries,groceries:d.groceries,tasks:d.tasks,shopping:d.shopping,
        installments:d.installments,householdPayments:d.householdPayments,gardenItems:d.gardenItems,gardenLogs:d.gardenLogs
      });
      const data={};
      FAMILY_COLLECTIONS.forEach(collection=>{ data[collection]=(sanitized[collection]||[]).filter(item=>item.shared!==false); });
      return {
        kind:'LifeHub family snapshot',schema:Math.max(1,Math.round(number(raw.schema)||1)),version:textLimit(raw.version,30),
        exportedAt:textLimit(raw.exportedAt,40)||new Date().toISOString(),
        owner:{id:textLimit(raw.owner?.id,80)||legacyFamilyId('member',raw.owner),name:textLimit(raw.owner?.name,60)||'Partner'},
        householdSettings:raw.householdSettings?{
          foodBudget:Math.max(0,number(hs.foodBudget)),fuelBudget:Math.max(0,number(hs.fuelBudget)),savingGoal:Math.max(0,number(hs.savingGoal)),
          updatedAt:textLimit(hs.updatedAt,40)||textLimit(raw.exportedAt,40)
        }:null,
        data
      };
    }
    function partnerFromFamily(family,mergedAt=''){
      return {name:family.owner?.name||'Partner',ownerId:family.owner?.id||'',exportedAt:family.exportedAt||'',importedAt:new Date().toISOString(),mergedAt,snapshot:cloneFamilyValue(family)};
    }
    function sanitizePartnerBlock(raw){
      if(!raw||typeof raw!=='object'||Array.isArray(raw)) return null;
      try{
        const family=sanitizeFamilyPayload(raw.snapshot||raw);
        return {
          name:textLimit(raw.name||family.owner?.name,60)||'Partner',ownerId:textLimit(raw.ownerId||family.owner?.id,80),
          exportedAt:textLimit(raw.exportedAt||family.exportedAt,40),importedAt:textLimit(raw.importedAt,40)||new Date().toISOString(),
          mergedAt:textLimit(raw.mergedAt,40),snapshot:family
        };
      }catch(err){ return null; }
    }
    function familyCounts(family){
      const d=family?.data||{};
      return Object.fromEntries(FAMILY_COLLECTIONS.map(collection=>[collection,Array.isArray(d[collection])?d[collection].length:0]));
    }
    function familyCountText(family){
      const c=familyCounts(family);
      return `finance ${c.transactions}, jídlo/benzín ${c.budgetEntries}, nákupní seznam ${c.groceries}, úkoly ${c.tasks}, velké nákupy ${c.shopping}, splátky ${c.installments}, platby ${c.householdPayments}, zahrada ${c.gardenItems+c.gardenLogs}`;
    }
    async function decodeFamilyFile(file){
      if(file.size>8*1024*1024) throw new Error('Rodinný soubor je příliš velký.');
      const envelope=JSON.parse(await file.text());
      if(hasForbiddenKeys(envelope)) throw new Error('Soubor obsahuje zakázané klíče.');
      if(envelope?.kind==='LifeHub encrypted backup'){
        const stored=String(state.settings.familyPassword||'');
        if(stored){
          try{return sanitizeFamilyPayload(await decryptBackupObject(envelope,stored));}
          catch(err){
            const replacement=await passwordDialog({title:'Rodinné heslo nesouhlasí',message:'Uložené rodinné heslo tento soubor neodemklo. Zadejte správné heslo; po úspěšném načtení nahradí dosavadní uložené heslo.',minLength:1,confirmText:'Odemknout a uložit'});
            if(!replacement)return null;
            try{
              const family=sanitizeFamilyPayload(await decryptBackupObject(envelope,replacement));
              if(replacement.length>=MIN_PASSWORD_LENGTH) state.settings.familyPassword=replacement;
              else toast(`Starší krátké rodinné heslo soubor odemklo, ale nebylo uloženo. Pro další export nastavte heslo alespoň ${MIN_PASSWORD_LENGTH} znaků.`,'warn');
              save(false);
              await saveInFlight.catch(()=>{});
              renderFamilyPasswordStatus();
              return family;
            }catch(inner){ throw new Error('Soubor se nepodařilo odemknout. Zkontrolujte heslo a neporušenost souboru.'); }
          }
        }
        const values=await passwordDialog({title:'Nastavit rodinné heslo',message:'Zadejte společné heslo k rodinnému souboru. Po úspěšném načtení se bezpečně uloží v tomto zařízení a příště se použije automaticky.',minLength:1,confirmText:'Odemknout a uložit'});
        if(!values) return null;
        try{
          const family=sanitizeFamilyPayload(await decryptBackupObject(envelope,values));
          if(values.length>=MIN_PASSWORD_LENGTH) state.settings.familyPassword=values;
          else toast(`Starší krátké rodinné heslo soubor odemklo, ale nebylo uloženo. Pro další export nastavte heslo alespoň ${MIN_PASSWORD_LENGTH} znaků.`,'warn');
          save(false);
          await saveInFlight.catch(()=>{});
          renderFamilyPasswordStatus();
          return family;
        }catch(err){ throw new Error('Soubor se nepodařilo odemknout. Zkontrolujte heslo a neporušenost souboru.'); }
      }
      if(['LifeHub family snapshot','LifeHub family sync','LifeHub partner share'].includes(envelope?.kind)){
        const ok=await confirmDialog('Tento starší rodinný soubor není šifrovaný. Načíst ho pouze kvůli kompatibilitě?',{title:'Nešifrovaný rodinný soubor',confirmText:'Načíst'});
        return ok?sanitizeFamilyPayload(envelope):null;
      }
      throw new Error('Toto není podporovaný rodinný soubor LifeHubu.');
    }
    async function importPartnerShare(e){
      const file=e.target.files?.[0]; e.target.value=''; if(!file)return;
      try{
        const family=await decodeFamilyFile(file); if(!family)return;
        if(family.owner?.id&&family.owner.id===state.settings.familyMemberId){
          toast('Tento soubor byl vytvořen na vašem vlastním LifeHubu. Náhled se přesto načte.','warn');
        }
        state.partner=partnerFromFamily(family);
        save(); renderPartner(); showTab('partner');
        toast(`Náhled dat od ${family.owner?.name||'partnera'} byl načten. Vaše vlastní data se nezměnila.`,'good');
      }catch(err){ console.error(err); toast('Rodinný soubor se nepodařilo načíst: '+(err.message||err),'bad'); }
    }
    async function deletePartnerData(){
      if(!state.partner){ toast('Žádný rodinný náhled není načtený.','warn'); return; }
      if(!await confirmDialog(`Odebrat načtený náhled (${state.partner.name})? Vaše vlastní data se nezmění.`,{title:'Odebrat náhled',confirmText:'Odebrat',danger:true}))return;
      state.partner=null; save(); renderPartner(); toast('Načtený rodinný náhled byl odebrán.','warn');
    }
    function partnerPanel(title,bodyHtml){ return `<article class="panel"><div class="panel-head"><div><p class="eyebrow">Rodinný náhled</p><h3>${esc(title)}</h3></div></div>${bodyHtml}</article>`; }
    function partnerExternalLink(url,label='Otevřít odkaz'){
      const safe=safeUrl(url);
      return safe?`<div class="meta partner-link-row"><a class="mini-btn partner-link" href="${attr(safe)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a></div>`:'';
    }
    function renderPartner(){
      const info=$('#partnerInfo'),content=$('#partnerContent'); if(!info||!content)return;
      const partner=state.partner;
      if(!partner?.snapshot){
        info.textContent='Zatím není načten žádný rodinný soubor. Partner vytvoří šifrovaný soubor a vy ho zde načtete jako náhled pouze pro čtení.';
        content.innerHTML=`<article class="panel"><h3>Co se přenáší</h3><p class="small">Sdílené finance, limity jídla a benzínu, nákupní seznam, rodinné úkoly, velké nákupy, splátky včetně historie, platby domácnosti a zahradní plán i deník. Výplatní pásky, dokumenty, osobní poznámky, AI výkaz, odměny a aplikace zůstávají soukromé.</p></article>`;
        return;
      }
      const family=partner.snapshot,d=family.data||{},c=familyCounts(family);
      info.textContent=`Náhled od: ${partner.name} • vytvořeno ${partner.exportedAt?new Date(partner.exportedAt).toLocaleString('cs-CZ'):'neuvedeno'} • pouze pro čtení`;
      const parts=[];
      const income=(d.transactions||[]).filter(t=>t.kind==='income').reduce((a,t)=>a+number(t.amount),0);
      const expenses=(d.transactions||[]).filter(t=>t.kind==='expense').reduce((a,t)=>a+number(t.amount),0);
      parts.push(partnerPanel('Souhrn rodinného souboru',`<div class="kpis"><div class="kpi"><div class="label">Příjmy ve sdílení</div><div class="value">${fmt(income)}</div><div class="sub">${c.transactions} transakcí</div></div><div class="kpi"><div class="label">Výdaje ve sdílení</div><div class="value">${fmt(expenses)}</div><div class="sub">Bilance ${fmt(income-expenses)}</div></div><div class="kpi"><div class="label">K ruční úhradě</div><div class="value">${(d.householdPayments||[]).filter(x=>x.status!=='paid'&&x.automatic!==true).length}</div><div class="sub">${(d.householdPayments||[]).filter(x=>x.status!=='paid'&&x.automatic===true).length} automatických</div></div><div class="kpi"><div class="label">Společné položky</div><div class="value">${Object.values(c).reduce((a,b)=>a+b,0)}</div><div class="sub">Bez soukromých modulů</div></div></div>`));
      if((d.transactions||[]).length){
        const rows=[...d.transactions].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,60).map(t=>`<article class="item"><div class="item-top"><div><h4>${t.kind==='income'?'Příjem':'Výdaj'}: ${esc(t.category)}</h4><p class="${t.kind==='income'?'money-plus':'money-minus'}">${t.kind==='income'?'+':'−'} ${fmt(t.amount)} • ${esc(t.date)}</p>${t.description?`<p>${esc(t.description)}</p>`:''}</div></div></article>`).join('');
        parts.push(partnerPanel(`Příjmy a výdaje (${c.transactions})`,`<div class="list">${rows}</div>`));
      }
      if((d.budgetEntries||[]).length){
        const totalFood=d.budgetEntries.filter(x=>x.kind==='food').reduce((a,x)=>a+number(x.amount),0),totalFuel=d.budgetEntries.filter(x=>x.kind==='fuel').reduce((a,x)=>a+number(x.amount),0);
        parts.push(partnerPanel(`Jídlo a benzín (${c.budgetEntries})`,`<p><strong>Jídlo:</strong> ${fmt(totalFood)} • <strong>Benzín:</strong> ${fmt(totalFuel)}</p><p class="small">Sdílené limity: jídlo ${fmt(family.householdSettings?.foodBudget||0)}, benzín ${fmt(family.householdSettings?.fuelBudget||0)}.</p>`));
      }
      if((d.householdPayments||[]).length){
        const rows=[...d.householdPayments].sort((a,b)=>String(a.dueDate).localeCompare(String(b.dueDate))).map(x=>`<article class="item"><div class="item-top"><div><h4>${x.status==='paid'?'✅ ':''}${x.automatic?'🏦 ':''}${esc(x.title)}</h4><p><strong>${fmt(x.amount)}</strong> • ${esc(paymentFrequencyLabel(x.frequency))} • ${x.automatic?'automaticky, další termín':'splatnost'} ${esc(x.dueDate)} • ${esc(partnerAssignedToLabel(x.assignedTo,partner.name))}</p>${x.note?`<p>${esc(x.note)}</p>`:''}</div></div></article>`).join('');
        parts.push(partnerPanel(`Účty a závazky (${c.householdPayments})`,`<div class="list">${rows}</div>`));
      }
      if((d.groceries||[]).length){
        const rows=d.groceries.map(g=>`<div class="grocery-item ${g.done?'done':''}"><input type="checkbox" ${g.done?'checked':''} disabled><span class="g-name">${esc(g.name)}${g.store?` <span class="g-note">· ${esc(g.store)}</span>`:''}</span></div>`).join('');
        parts.push(partnerPanel(`Nákupní seznam (${c.groceries})`,rows));
      }
      if((d.tasks||[]).length){
        const rows=d.tasks.map(t=>`<article class="item"><div class="item-top"><div><h4>${t.done?'✅ ':''}${esc(t.title)}</h4><p>${esc(taskPriorityLabel(t.priority))} • ${esc(partnerAssignedToLabel(t.assignedTo,partner.name))}${t.due?' • do '+esc(t.due):''}</p>${t.note?`<p>${esc(t.note)}</p>`:''}</div></div></article>`).join('');
        parts.push(partnerPanel(`Rodinné úkoly (${c.tasks})`,`<div class="list">${rows}</div>`));
      }
      if((d.shopping||[]).length){
        const rows=d.shopping.map(x=>`<article class="item"><div class="item-top"><div><h4>${esc(x.name)}</h4><p>${x.price?`<strong>${fmt(x.price)}</strong> • `:''}${esc(shopStatusLabel(x.status))}${x.month?' • '+esc(monthLabel(x.month)):''}</p>${x.note?`<p>${esc(x.note)}</p>`:''}${partnerExternalLink(x.url,'Otevřít produkt / nabídku')}</div></div></article>`).join('');
        parts.push(partnerPanel(`Velké nákupy a plány (${c.shopping})`,`<div class="list">${rows}</div>`));
      }
      if((d.installments||[]).length){
        const rows=d.installments.map(i=>{const calc=computeInstallment(i),last=i.paymentHistory?.[0];return `<article class="item"><div class="item-top"><div><h4>${esc(i.creditor)}</h4><p>zbývá <strong>${fmt(calc.remaining)}</strong> • měsíčně ${fmt(i.monthly)} • ${esc(partnerAssignedToLabel(i.assignedTo,partner.name))}</p>${last?`<p>Poslední platba ${esc(last.date)}: ${fmt(last.amount)}</p>`:''}</div></div></article>`;}).join('');
        parts.push(partnerPanel(`Splátky (${c.installments})`,`<div class="list">${rows}</div>`));
      }
      if((d.gardenItems||[]).length||(d.gardenLogs||[]).length){
        const itemRows=(d.gardenItems||[]).map(g=>`<article class="item"><h4>${g.done?'✅ ':''}${esc(g.name)}</h4><p>${fmt(g.price)} • ${esc(gardenHorizonLabel(g.horizon))}</p>${g.note?`<p>${esc(g.note)}</p>`:''}${partnerExternalLink(g.url,'Otevřít odkaz')}</article>`).join('');
        const logRows=[...(d.gardenLogs||[])].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,30).map(g=>`<article class="item"><h4>${esc(gardenTypeLabel(g.type))}${g.area?' • '+esc(g.area):''}</h4><p>${esc(g.date)}${g.note?' • '+esc(g.note):''}</p></article>`).join('');
        parts.push(partnerPanel(`Zahrada (${c.gardenItems} položek, ${c.gardenLogs} záznamů)`,`<div class="grid two"><div><h4>K pořízení</h4><div class="list">${itemRows||empty('Bez položek')}</div></div><div><h4>Deník údržby</h4><div class="list">${logRows||empty('Bez záznamů')}</div></div></div>`));
      }
      content.innerHTML=parts.join('');
    }

    // ===== Tiskové výkazy (PDF přes tisk + HTML ke stažení) =====
    function reportOwner(){
      const raw=(state.settings.ownerName||'').replace(/^Vlastník aplikace:\s*/i,'').trim()||'Daniel Baláž · Gymnázium, Ostrava-Hrabůvka';
      const parts=raw.split('·').map(s=>s.trim()).filter(Boolean);
      return {name:parts[0]||'Daniel Baláž', org:parts.slice(1).join(' · ')};
    }
    const AI_REPORT_COLORS=['#1f5fbf','#7a3fc2','#1d9b58','#ef8b17','#0b9fb3','#d4477b','#64748b','#d22f3c'];
    const SCHOOL_OFFICIAL_NAME='Gymnázium, Ostrava-Hrabůvka';
    const SCHOOL_LEGAL_FORM='příspěvková organizace';
    function aiReportGroups(entries){
      const grouped=new Map();
      entries.forEach(entry=>{
        const key=String(entry.activity||'Bez názvu').trim()||'Bez názvu';
        grouped.set(key,(grouped.get(key)||0)+Math.max(0,Math.round(number(entry.minutes))));
      });
      const sorted=[...grouped.entries()].map(([label,minutes])=>({label,minutes})).sort((a,b)=>b.minutes-a.minutes);
      const visible=sorted.slice(0,7);
      if(sorted.length>7){
        visible.push({label:'Ostatní činnosti',minutes:sorted.slice(7).reduce((sum,item)=>sum+item.minutes,0)});
      }
      return visible.map((item,index)=>({...item,color:AI_REPORT_COLORS[index%AI_REPORT_COLORS.length]}));
    }
    function aiReportDonut(groups,total){
      if(!(total>0)) return 'conic-gradient(#dce5f2 0 100%)';
      let start=0;
      const stops=groups.map(group=>{
        const end=start+(group.minutes/total*100);
        const stop=`${group.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
        start=end;
        return stop;
      });
      if(start<100) stops.push(`#dce5f2 ${start.toFixed(2)}% 100%`);
      return `conic-gradient(${stops.join(',')})`;
    }
    function buildAiReportHtml(month){
      const entries=state.aiEntries.filter(a=>String(a.date||'').startsWith(month)).sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.activity).localeCompare(String(b.activity),'cs'));
      const total=entries.reduce((sum,entry)=>sum+Math.max(0,Math.round(number(entry.minutes))),0);
      const owner=reportOwner();
      const closed=(state.aiClosedMonths||[]).find(c=>c.month===month);
      const groups=aiReportGroups(entries);
      const donut=aiReportDonut(groups,total);
      const rows=entries.map((entry,index)=>{
        const color=AI_REPORT_COLORS[index%AI_REPORT_COLORS.length];
        return `<tr><td class="report-index"><span style="--row-color:${color}">${index+1}</span></td><td class="report-date">${esc(fmtDate(`${entry.date}T00:00:00`))}</td><td><strong>${esc(entry.activity)}</strong>${entry.note?`<div class="report-note">${esc(entry.note)}</div>`:''}</td><td class="report-time">${esc(minutesLabel(entry.minutes))}</td></tr>`;
      }).join('')||'<tr><td colspan="4" class="report-empty">V tomto měsíci nejsou žádné záznamy.</td></tr>';
      const legend=groups.map(group=>{
        const percent=total>0?group.minutes/total*100:0;
        return `<li><span class="report-legend-dot" style="--legend-color:${group.color}"></span><span class="report-legend-label">${esc(group.label)}</span><strong>${esc(minutesLabel(group.minutes))}</strong><em>${percent.toLocaleString('cs-CZ',{maximumFractionDigits:1})} %</em></li>`;
      }).join('')||'<li class="report-empty">Bez záznamů</li>';
      const status=closed?'Připraveno k předání':'Pracovní verze';
      const statusClass=closed?'ready':'draft';
      return `<main class="lh-report">
        <header class="report-header">
          <div class="report-school"><img src="${SCHOOL_LOGO_DATA_URI}" alt="Logo Gymnázia Ostrava-Hrabůvka"><div><strong>${SCHOOL_OFFICIAL_NAME}</strong><span>${SCHOOL_LEGAL_FORM}</span></div></div>
          <div class="report-heading"><p>LifeHub · měsíční pracovní výkaz</p><h1>Měsíční výkaz činností pedagoga</h1></div>
        </header>
        <section class="report-meta-grid">
          <article><span>Jméno</span><strong>${esc(owner.name)}</strong></article>
          <article><span>Období</span><strong>${esc(monthLabel(month))}</strong></article>
          <article><span>Počet položek</span><strong>${entries.length.toLocaleString('cs-CZ')}</strong></article>
          <article class="report-status ${statusClass}"><span>Stav výkazu</span><strong>${status}</strong></article>
        </section>
        <section class="report-section">
          <div class="report-section-title"><div><span>Přehled vykázaných činností</span><h2>Co bylo v průběhu měsíce provedeno</h2></div><strong>${esc(minutesLabel(total))}</strong></div>
          <div class="report-table-wrap"><table class="report-table"><thead><tr><th>#</th><th>Datum</th><th>Činnost a popis</th><th>Čas</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="3">Celkem vykázáno za měsíc</td><td class="report-time">${esc(minutesLabel(total))}</td></tr></tfoot></table></div>
        </section>
        <section class="report-summary-grid">
          <article class="report-distribution"><div class="report-section-title compact"><div><span>Rozložení času</span><h2>Podíl jednotlivých činností</h2></div></div><div class="report-chart-layout"><div class="report-donut" style="--report-donut:${donut}"><div><strong>${esc(minutesLabel(total))}</strong><span>celkem</span></div></div><ul class="report-legend">${legend}</ul></div></article>
          <article class="report-total-card"><span>Celkem za měsíc</span><strong>${esc(minutesLabel(total))}</strong><p>${entries.length?`Výkaz obsahuje ${entries.length} ${entries.length===1?'položku':entries.length<5?'položky':'položek'} s uvedeným dílčím časem.`:'Výkaz zatím neobsahuje žádnou položku.'}</p></article>
        </section>
        <section class="report-signatures"><div><span>Zpracoval</span><strong>${esc(owner.name)}</strong><i>datum a podpis</i></div><div><span>Převzala</span><strong>Vedení školy</strong><i>datum a podpis</i></div></section>
        <footer class="report-footer"><span>${SCHOOL_OFFICIAL_NAME}, ${SCHOOL_LEGAL_FORM}</span><span>Vygenerováno v LifeHubu ${esc(VERSION)} dne ${esc(fmtDate(new Date().toISOString()))}${closed?` · uzavřeno ${esc(fmtDate(closed.closedAt))}`:''}</span></footer>
      </main>`;
    }
    function buildRewardReportHtml(period){
      const items=state.rewards.filter(r=>r.period===period);
      const total=sumRewardHours(state.rewards,period);
      const owner=reportOwner();
      const rows=items.map(r=>`<tr><td>${esc(r.title)}</td><td class="num">${esc(fmtHours(r.hours))}</td><td>${esc(r.note||'')}</td></tr>`).join('')||'<tr><td colspan="3">V tomto období nejsou žádné položky.</td></tr>';
      return `<h1>Podklady pro odměny</h1><p class="report-sub">${esc(rewardPeriodLabel(period))}</p><p class="report-meta"><strong>${esc(owner.name)}</strong>${owner.org?` · ${esc(owner.org)}`:''}</p><table><thead><tr><th>Činnost</th><th class="num">Hodiny</th><th>Poznámka</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td>Celkem</td><td class="num">${esc(fmtHours(total))}</td><td></td></tr></tfoot></table><div class="report-sign"><div>${esc(owner.name)}<br><small>zpracoval</small></div><div>Podpis ředitelky školy</div></div><p class="report-foot">Vygenerováno aplikací LifeHub v${esc(VERSION)} dne ${esc(fmtDate(new Date().toISOString()))}.</p>`;
    }
    function printReport(html){
      const box=$('#printReport'); if(!box) return;
      box.innerHTML=html;
      box.hidden=false;
      box.setAttribute('aria-hidden','false');
      document.body.classList.add('print-mode');
      let done=false;
      const cleanup=()=>{ if(done) return; done=true; document.body.classList.remove('print-mode'); box.hidden=true; box.setAttribute('aria-hidden','true'); box.innerHTML=''; window.removeEventListener('afterprint',cleanup); };
      window.addEventListener('afterprint',cleanup);
      setTimeout(()=>{
        try{ window.print(); }
        catch(err){ console.warn(err); toast('Tiskový dialog se nepodařilo otevřít. Použijte stažení HTML.','warn'); cleanup(); return; }
        if(!('onafterprint' in window)) setTimeout(cleanup, 2000);
      }, 80);
    }
    function reportDocumentHtml(title, bodyHtml){
      return `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(title)}</title><style>
      :root{--report-navy:#082e67;--report-blue:#1f5fbf;--report-red:#cf2e3a;--report-ink:#10213d;--report-muted:#65738a;--report-line:#d7e0ec;--report-soft:#f2f6fb;--report-green:#238a45}
      *{box-sizing:border-box}body{margin:0;padding:28px;background:linear-gradient(145deg,#e8eef7,#f7f9fc);color:var(--report-ink);font-family:Inter,"Segoe UI",Arial,sans-serif;line-height:1.45}.lh-report{width:min(1180px,100%);margin:0 auto;background:#fff;border:1px solid #d9e1ec;border-radius:24px;box-shadow:0 24px 70px rgba(20,43,79,.16);overflow:hidden}.report-header{display:grid;grid-template-columns:minmax(300px,.9fr) minmax(360px,1.1fr);align-items:center;gap:28px;padding:30px 38px;background:linear-gradient(112deg,#fff 0 48%,#eef4ff 48% 67%,#0a3778 67% 100%);border-bottom:4px solid var(--report-red)}.report-school{display:flex;align-items:center;gap:18px;min-width:0}.report-school img{width:82px;height:68px;object-fit:contain;flex:0 0 auto}.report-school div{display:grid;gap:2px}.report-school strong{font-size:1.12rem;line-height:1.2}.report-school span{font-size:.9rem;color:var(--report-muted)}.report-heading{text-align:right;color:#fff}.report-heading p{margin:0 0 4px;font-size:.82rem;font-weight:800;text-transform:uppercase;letter-spacing:.11em;color:#d7e6ff}.report-heading h1{margin:0;font-size:clamp(1.75rem,3vw,2.65rem);line-height:1.08;letter-spacing:-.035em}.report-meta-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;padding:22px 38px}.report-meta-grid article{display:grid;gap:3px;padding:15px 17px;border:1px solid var(--report-line);border-radius:16px;background:linear-gradient(145deg,#fff,#f6f9fd)}.report-meta-grid span{font-size:.76rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--report-muted)}.report-meta-grid strong{font-size:1.05rem}.report-status.ready{border-color:#b9dfc3;background:#f0fbf3}.report-status.ready strong{color:var(--report-green)}.report-status.draft{border-color:#f0d49d;background:#fff9eb}.report-status.draft strong{color:#9a6712}.report-section{padding:6px 38px 22px}.report-section-title{display:flex;align-items:end;justify-content:space-between;gap:20px;margin:0 0 12px}.report-section-title.compact{margin-bottom:14px}.report-section-title span{display:block;margin-bottom:2px;font-size:.76rem;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:var(--report-blue)}.report-section-title h2{margin:0;font-size:1.25rem;letter-spacing:-.02em}.report-section-title>strong{font-size:1.35rem;color:var(--report-navy)}.report-table-wrap{overflow:auto;border:1px solid var(--report-line);border-radius:16px}.report-table{width:100%;border-collapse:separate;border-spacing:0;min-width:720px}.report-table th{padding:11px 12px;background:var(--report-navy);color:#fff;text-align:left;font-size:.78rem;text-transform:uppercase;letter-spacing:.055em}.report-table th:first-child{width:54px;text-align:center}.report-table th:nth-child(2){width:142px}.report-table th:last-child{text-align:right;width:112px}.report-table td{padding:12px;border-bottom:1px solid var(--report-line);vertical-align:top;font-size:.9rem}.report-table tbody tr:last-child td{border-bottom:0}.report-table tbody tr:nth-child(even){background:#f8fafd}.report-index{text-align:center}.report-index span{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:50%;background:var(--row-color);color:#fff;font-weight:900}.report-date{white-space:nowrap;color:var(--report-muted)}.report-time{text-align:right;white-space:nowrap;font-weight:900;color:var(--report-navy)}.report-note{margin-top:4px;color:var(--report-muted);font-size:.82rem;white-space:pre-wrap}.report-table tfoot td{padding:13px 12px;background:#eaf2ff;border-top:2px solid #b8ccec;border-bottom:0;font-weight:900}.report-empty{text-align:center;color:var(--report-muted);padding:26px!important}.report-summary-grid{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(280px,.7fr);gap:18px;padding:0 38px 26px}.report-distribution,.report-total-card{border:1px solid var(--report-line);border-radius:18px;padding:20px;background:#fff}.report-chart-layout{display:grid;grid-template-columns:190px minmax(0,1fr);gap:22px;align-items:center}.report-donut{width:178px;aspect-ratio:1;border-radius:50%;background:var(--report-donut);display:grid;place-items:center;position:relative}.report-donut::after{content:"";position:absolute;inset:25%;border-radius:50%;background:#fff;box-shadow:0 0 0 1px #e2e8f0}.report-donut div{position:relative;z-index:1;display:grid;text-align:center}.report-donut strong{font-size:1.18rem;color:var(--report-navy)}.report-donut span{font-size:.72rem;color:var(--report-muted);text-transform:uppercase;letter-spacing:.08em}.report-legend{list-style:none;margin:0;padding:0;display:grid;gap:7px}.report-legend li{display:grid;grid-template-columns:12px minmax(0,1fr) auto 54px;align-items:center;gap:8px;font-size:.78rem}.report-legend-dot{width:10px;height:10px;border-radius:50%;background:var(--legend-color)}.report-legend-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.report-legend strong{white-space:nowrap}.report-legend em{text-align:right;font-style:normal;color:var(--report-muted)}.report-total-card{display:flex;flex-direction:column;justify-content:center;background:linear-gradient(145deg,#eef9f1,#fff);border-color:#b9dfc3}.report-total-card>span{font-size:.82rem;font-weight:900;text-transform:uppercase;letter-spacing:.09em;color:#467454}.report-total-card>strong{margin:5px 0;font-size:2.45rem;line-height:1;color:var(--report-green)}.report-total-card p{margin:7px 0 0;color:#5b6a60;font-size:.86rem}.report-signatures{display:grid;grid-template-columns:1fr 1fr;gap:46px;padding:18px 38px 30px}.report-signatures div{display:grid;grid-template-columns:1fr auto;gap:5px 14px;border-top:1px solid #8fa0b6;padding-top:8px}.report-signatures span{font-size:.76rem;text-transform:uppercase;letter-spacing:.08em;color:var(--report-muted)}.report-signatures strong{grid-row:2;grid-column:1}.report-signatures i{grid-row:2;grid-column:2;font-size:.72rem;font-style:normal;color:var(--report-muted)}.report-footer{display:flex;justify-content:space-between;gap:24px;padding:16px 38px;background:var(--report-navy);color:#dbe8fb;font-size:.74rem}.report-footer span:last-child{text-align:right}body>h1{font-size:24px;margin:0 0 4px}body>.report-sub{color:#444;margin:0 0 14px;font-size:17px}body>.report-meta{margin:0 0 16px;font-size:15px;color:#333}body>table{width:100%;border-collapse:collapse;margin:0 0 16px;background:#fff}body>table th,body>table td{border:1px solid #999;padding:7px 9px;text-align:left;font-size:14px;vertical-align:top}body>table th{background:#f0f0f0}body>table td.num,body>table th.num{text-align:right;white-space:nowrap}body>table tfoot td{font-weight:700;background:#f7f7f7}.report-sign{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:44px;font-size:15px}.report-sign div{border-top:1px solid #111;padding-top:6px}.report-foot{margin-top:22px;font-size:12px;color:#555}small{color:#555}
      @media(max-width:760px){body{padding:0;background:#fff}.lh-report{border:0;border-radius:0;box-shadow:none}.report-header{grid-template-columns:1fr;gap:18px;padding:24px 18px;background:linear-gradient(150deg,#fff 0 58%,#eef4ff 58% 72%,#0a3778 72% 100%)}.report-heading{text-align:left;color:var(--report-ink);padding-top:12px}.report-heading p{color:var(--report-blue)}.report-heading h1{font-size:1.9rem}.report-school img{width:66px;height:56px}.report-meta-grid{grid-template-columns:1fr 1fr;padding:18px;gap:10px}.report-section{padding:4px 18px 18px}.report-section-title{align-items:flex-start}.report-section-title>strong{font-size:1.1rem}.report-table-wrap{border:0;overflow:visible}.report-table{min-width:0}.report-table thead{display:none}.report-table,.report-table tbody,.report-table tr,.report-table td{display:block;width:100%}.report-table tbody{display:grid;gap:10px}.report-table tbody tr{position:relative;padding:13px 14px 13px 58px;border:1px solid var(--report-line);border-radius:14px;background:#fff!important}.report-table td{padding:2px 0;border:0}.report-table .report-index{position:absolute;left:14px;top:14px;width:32px}.report-table .report-date{font-size:.76rem}.report-table .report-time{text-align:left;margin-top:7px;font-size:1rem}.report-table tfoot{display:block;margin-top:12px}.report-table tfoot tr{display:flex;align-items:center;justify-content:space-between;padding:14px;background:#eaf2ff;border-radius:14px}.report-table tfoot td{display:block;width:auto;padding:0;background:transparent;border:0}.report-summary-grid{grid-template-columns:1fr;padding:0 18px 20px}.report-chart-layout{grid-template-columns:130px minmax(0,1fr);gap:14px}.report-donut{width:126px}.report-legend li{grid-template-columns:10px minmax(0,1fr) auto}.report-legend em{display:none}.report-signatures{grid-template-columns:1fr;gap:32px;padding:12px 18px 26px}.report-footer{display:grid;padding:15px 18px}.report-footer span:last-child{text-align:left}}
      @page{size:A4 portrait;margin:8mm}@media print{body{padding:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}.lh-report{width:100%;border:0;border-radius:0;box-shadow:none}.report-header{grid-template-columns:42% 58%;padding:9mm 8mm 7mm;gap:8mm}.report-school img{width:18mm;height:15mm}.report-school strong{font-size:10.5pt}.report-school span{font-size:8pt}.report-heading p{font-size:7pt}.report-heading h1{font-size:18pt}.report-meta-grid{padding:5mm 8mm;gap:3mm}.report-meta-grid article{padding:3mm 3.5mm;border-radius:3mm}.report-meta-grid span{font-size:6.5pt}.report-meta-grid strong{font-size:8.5pt}.report-section{padding:1mm 8mm 4mm}.report-section-title{margin-bottom:3mm}.report-section-title span{font-size:6.5pt}.report-section-title h2{font-size:10.5pt}.report-section-title>strong{font-size:11pt}.report-table-wrap{border-radius:3mm;overflow:hidden}.report-table{min-width:0}.report-table th{padding:2.2mm 2.4mm;font-size:6.5pt}.report-table td{padding:2.2mm 2.4mm;font-size:7.4pt}.report-index span{width:6mm;height:6mm;font-size:6.5pt}.report-note{font-size:6.5pt}.report-summary-grid{grid-template-columns:1.55fr .75fr;gap:4mm;padding:0 8mm 4mm;break-inside:avoid}.report-distribution,.report-total-card{padding:4mm;border-radius:3.5mm}.report-chart-layout{grid-template-columns:34mm minmax(0,1fr);gap:4mm}.report-donut{width:32mm}.report-donut strong{font-size:8pt}.report-legend{gap:1.2mm}.report-legend li{font-size:6.2pt;grid-template-columns:2.5mm minmax(0,1fr) auto 10mm;gap:1.5mm}.report-total-card>strong{font-size:20pt}.report-total-card p{font-size:6.5pt}.report-signatures{padding:4mm 8mm 6mm;gap:12mm}.report-signatures span,.report-signatures i{font-size:6pt}.report-signatures strong{font-size:7.5pt}.report-footer{padding:3mm 8mm;font-size:5.8pt}.report-table tr,.report-distribution,.report-total-card{break-inside:avoid}body>h1{font-size:18pt}body>table th,body>table td{font-size:9pt}}
      </style></head><body>${bodyHtml}</body></html>`;
    }
    function downloadAiReportHtml(){
      const month=$('#aiMonth')?.value||monthNow();
      download(`lifehub-mesicni-vykaz-${month}.html`, reportDocumentHtml(`Měsíční výkaz činností pedagoga – ${monthLabel(month)}`, buildAiReportHtml(month)), 'text/html;charset=utf-8');
    }
    function downloadRewardReportHtml(){
      const period=selectedRewardPeriod();
      download(`lifehub-odmeny-${period}.html`, reportDocumentHtml(`Podklady pro odměny – ${rewardPeriodLabel(period)}`, buildRewardReportHtml(period)), 'text/html;charset=utf-8');
    }

    function fmtDate(iso){ try{ return new Date(iso).toLocaleDateString('cs-CZ',{day:'numeric',month:'long',year:'numeric'}); }catch(e){ return ''; } }
    function empty(text){return `<div class="empty">${esc(text)}</div>`;}
    let updatePromptOpen = false;
    async function handleUpdateReady(event){
      const activate = event.detail?.activate;
      if(typeof activate !== 'function' || updatePromptOpen) return;
      if(pendingSaveCount > 0 || saveLifecycle.blocksSafeLock){
        toast('Nová verze LifeHubu je připravena. Dokončete nejprve bezpečné uložení změn.', 'warn');
        return;
      }
      updatePromptOpen = true;
      try{
        const accepted = await confirmDialog(
          'Nová verze LifeHubu je připravena. Aplikace se bezpečně obnoví; uložená data ani PIN se nezmění.',
          {title:'Aktualizace LifeHubu', confirmText:'Aktualizovat nyní', cancelText:'Později'}
        );
        if(!accepted) return;
        closeAllModals();
        toast('Aktualizuji LifeHub…', 'good');
        activate();
      }finally{
        updatePromptOpen = false;
      }
    }
    function registerSW(){
      window.addEventListener('lifehub:update-ready', handleUpdateReady);
      registerServiceWorker('./sw.js');
    }
    init().catch(error => {
      console.error('LifeHub se nepodařilo spustit.', error);
      const screen = $('#lockScreen');
      screen?.classList.add('active');
      document.body.classList.add('locked');
      setAppInert(true);
      const title = $('#lockTitle');
      const intro = $('#lockIntro');
      const note = $('#lockNote');
      const status = $('#lockStatus');
      if(title) title.textContent = 'LifeHub se nepodařilo bezpečně spustit';
      if(intro) intro.textContent = 'Nezakládejte nový trezor a nemažte data aplikace.';
      if(note) note.textContent = 'Aplikaci úplně zavřete a znovu otevřete. Pokud problém přetrvá, použijte opravnou verzi LifeHubu; původní lokální data se touto chybou sama nemažou.';
      if(status) status.textContent = error?.message || 'Neznámá chyba při spuštění.';
      $('#lockRepeatWrap')?.classList.add('hide');
      $('#lockRememberWrap')?.classList.add('hide');
      const unlock = $('#unlockBtn');
      if(unlock) unlock.disabled = true;
      $('#wipeEncryptedBtn')?.classList.add('hide');
    });
}
