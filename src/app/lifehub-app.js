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
  PDF_DB,
  PDF_STORE,
  VAULT_STORE
} from '../config/constants.js';
import { registerServiceWorker } from '../pwa/register-sw.js';
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
import { confirmDialog, download, passwordDialog, toast } from '../core/ui.js';
import {
  deriveVaultKey as cryptoDeriveVaultKey,
  encryptObjectWithKey as cryptoEncryptObjectWithKey,
  decryptObjectWithKey as cryptoDecryptObjectWithKey,
  encryptBlobForIdb as cryptoEncryptBlobForIdb,
  decryptBlobFromIdb as cryptoDecryptBlobFromIdb,
  bytesToB64 as cryptoBytesToB64,
  b64ToBytes as cryptoB64ToBytes,
  deriveBackupKey as cryptoDeriveBackupKey,
  encryptBackupObject as cryptoEncryptBackupObject,
  decryptBackupObject as cryptoDecryptBackupObject,
} from '../security/crypto.js';

export function bootLifeHub(){
    'use strict';

    const VERSION = APP_VERSION;
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      settings:{theme:'dark', ownerName:'Vlastník aplikace: Daniel Baláž · Gymnázium, Ostrava-Hrabůvka', ownerFooter:'© 2026 Daniel Baláž. Všechna práva vyhrazena.', currency:'Kč', savingGoal:0},
      notes:[], transactions:[], payrolls:[], documents:[], tasks:[], shopping:[]
    });
    let state = defaultState();
    let vaultKey = null;
    let vaultSalt = null;
    let appReady = false;
    let saveInFlight = Promise.resolve();
    let autoLockTimer = null;
    let currentPayroll = {file:null, text:'', parsed:{}, evidence:{}};
    const payFieldDefs = [
      ['netPay','Čistá mzda / k výplatě',['cista mzda','k vyplate','castka k vyplate','doplatek k vyplate','cisty prijem','vyplaceno','na ucet']],
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
    function hasEncryptedState(){
      try{return !!localStorage.getItem(ENC_STORE);}catch(e){return false;}
    }
    function hasLegacyState(){
      try{return !!localStorage.getItem(LEGACY_STORE);}catch(e){return false;}
    }
    function merge(base, saved){
      if(!saved || typeof saved !== 'object' || Array.isArray(saved)) return base;
      for(const k of Object.keys(saved)){
        if(FORBIDDEN_IMPORT_KEYS.has(k)) continue;
        if(!Object.prototype.hasOwnProperty.call(base, k)) continue;
        const incoming = saved[k];
        const current = base[k];
        if(incoming && typeof incoming === 'object' && !Array.isArray(incoming) && current && typeof current === 'object' && !Array.isArray(current)){
          base[k] = merge(current, incoming);
        }else{
          base[k] = incoming;
        }
      }
      base.version = VERSION;
      return base;
    }
    function save(render=true){
      if(!appReady || !vaultKey){
        if(render && appReady) renderAll();
        return;
      }
      state.updatedAt = new Date().toISOString();
      $('#saveStatus').textContent = 'Šifruji…';
      const keyForSave = vaultKey;
      const saltForSave = vaultSalt;
      const snapshotForSave = JSON.parse(JSON.stringify(state));
      saveInFlight = saveInFlight.catch(()=>{}).then(()=>persistEncryptedState(keyForSave, saltForSave, snapshotForSave));
      saveInFlight.then(()=>{$('#saveStatus').textContent = 'Šifrováno ' + new Date().toLocaleTimeString('cs-CZ',{hour:'2-digit',minute:'2-digit'});}).catch(err=>{
        console.error(err);
        $('#saveStatus').textContent = 'Uložení selhalo';
        toast('Šifrované uložení se nepodařilo: '+(err.message||err), 'bad');
      });
      if(render) renderAll();
    }
    async function persistEncryptedState(key=vaultKey, salt=vaultSalt, snapshot=state){
      if(!key || !salt) throw new Error('Trezor není odemčený.');
      const encrypted = await encryptObjectWithKey(snapshot, key);
      const envelope = {kind:'LifeHub encrypted local state',version:VERSION,updatedAt:new Date().toISOString(),crypto:{alg:'AES-GCM',kdf:'PBKDF2-SHA256',iterations:KDF_ITERATIONS,salt:bytesToB64(salt),iv:encrypted.iv},data:encrypted.data};
      localStorage.setItem(ENC_STORE, JSON.stringify(envelope));
      localStorage.removeItem(LEGACY_STORE);
    }
    function csv(rows){
      return rows.map(r=>r.map(v=>`"${safeCsvCell(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    }
    function mdEscape(s){return String(s??'').replace(/\r/g,'').trim();}
    function setTheme(theme){
      state.settings.theme = theme;
      document.documentElement.dataset.theme = theme;
      document.querySelector('meta[name="theme-color"]').setAttribute('content', theme==='dark'?'#20134d':'#f7f2ff');
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
      $('#transDate').value = today();
      $('#shopMonth').value = monthNow();
      renderPayrollFieldInputs();
      bind();
      hydrateSettings();
      renderFooter();
      await startSecureGate();
      registerSW();
    }
    function bind(){
      $$('.nav button').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));
      document.addEventListener('click', handleActions);
      $('#themeBtn').addEventListener('click',()=>{setTheme(state.settings.theme==='dark'?'light':'dark'); save(false);});
      $('#lockBtn')?.addEventListener('click',lockApp);
      $('#lockForm')?.addEventListener('submit',handleUnlockSubmit);
      $('#wipeEncryptedBtn')?.addEventListener('click',wipeEncryptedVault);
      ['mousemove','keydown','click','touchstart'].forEach(ev=>document.addEventListener(ev,resetAutoLockTimer,{passive:true}));
      document.addEventListener('visibilitychange',()=>{ if(!document.hidden && appReady) resetAutoLockTimer(); });
      document.addEventListener('keydown',trapLockFocus);
      $('#fullscreenBtn').addEventListener('click',()=> document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.());
      $('#noteForm').addEventListener('submit', saveNote);
      $('#resetNote').addEventListener('click', resetNoteForm);
      ['noteSearch','noteSourceFilter','noteTypeFilter','noteTagFilter','noteSort'].forEach(id=>$('#'+id).addEventListener('input',renderNotes));
      $('#globalSearch').addEventListener('input',renderGlobalSearch);
      $('#parsePayrollBtn').addEventListener('click',parsePayrollPdf);
      $('#payrollPdf').addEventListener('change',()=>{ if($('#payrollPdf').files[0]) parsePayrollPdf(); });
      $('#clearPayrollBtn').addEventListener('click',clearPayrollImport);
      $('#savePayrollBtn').addEventListener('click',savePayrollRecord);
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
      ['shopSearch','shopPriorityFilter','shopStatusFilter','shopCategoryFilter','shopSort','shoppingYear'].forEach(id=>$('#'+id).addEventListener('input',renderShopping));
      $('#settingsForm').addEventListener('submit',saveSettings);
      $('#runDiagnostics').addEventListener('click',runDiagnostics);
      $('#seedDemo').addEventListener('click',seedDemo);
      $('#clearAll').addEventListener('click',clearAllData);
      $('#requestPersist').addEventListener('click',requestPersistentStorage);
      $('#requestPersistSettings').addEventListener('click',requestPersistentStorage);
      $('#importJson').addEventListener('change',importJson);
      $('#copyMarkdown').addEventListener('click',()=>navigator.clipboard?.writeText(buildMarkdown()).then(()=>toast('Markdown zkopírován.')).catch(()=>toast('Kopírování se nepovedlo.', 'bad')));
    }
    function showTab(id){
      $$('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));
      $$('.view').forEach(v=>v.classList.toggle('active',v.id===id));
      window.scrollTo({top:0,behavior:'smooth'});
      if(id==='exports') $('#markdownPreview').textContent = buildMarkdown();
      renderAll();
    }
    async function handleActions(e){
      const jump = e.target.closest('[data-jump]')?.dataset.jump;
      if(jump){ e.preventDefault(); showTab(jump); return; }
      const action = e.target.closest('[data-action]')?.dataset.action;
      if(action){
        const map = {
          'export-json':exportJson,'export-encrypted-json':exportEncryptedJson,'lock-app':lockApp,'export-all-md':async()=>{ if(await confirmPrivateExport('Soukromý Markdown')) download('lifehub-soukromy-export.md', buildMarkdown(),'text/markdown;charset=utf-8'); },
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
          'export-payrolls-csv':()=>exportCsv('payrolls'), 'export-tasks-csv':()=>exportCsv('tasks'), 'export-shopping-csv':()=>exportCsv('shopping')
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
      if(editNote) editNoteForm(editNote); if(delNote) deleteItem('notes',delNote);
      if(editTrans) editTransactionForm(editTrans); if(delTrans) deleteItem('transactions',delTrans);
      if(delPayroll) deletePayroll(delPayroll); if(downPayroll) downloadPayrollPdf(downPayroll); if(purgePayroll) purgePayrollPdf(purgePayroll);
      if(delDoc) deleteVaultDoc(delDoc); if(downDoc) downloadVaultDoc(downDoc);
      if(editTask) editTaskForm(editTask); if(delTask) deleteItem('tasks',delTask); if(toggleTask) toggleTaskDone(toggleTask);
      if(editShop) editShoppingForm(editShop); if(delShop) deleteItem('shopping',delShop);
    }
    async function deleteItem(collection,id){
      if(!await confirmDialog('Opravdu smazat tuto položku?', {title:'Smazat položku', confirmText:'Smazat', danger:true})) return;
      state[collection] = state[collection].filter(x=>x.id!==id); save(); toast('Položka smazána.','warn');
    }

    function renderAll(){renderDashboard();renderNotes();renderFinance();renderVault();renderTasks();renderShopping();renderFooter();addAccessibilityLabels();}

    async function startSecureGate(){
      const screen = $('#lockScreen');
      if(!window.crypto?.subtle){
        $('#lockStatus').textContent = 'Web Crypto API není dostupné. LifeHub 3.0 vyžaduje moderní prohlížeč a bezpečný kontext.';
        return;
      }
      screen?.classList.add('active');
      document.body.classList.add('locked');
      setAppInert(true);
      const encrypted = hasEncryptedState();
      const legacy = hasLegacyState();
      const repeatWrap = $('#lockRepeatWrap');
      const migrateWrap = $('#lockRememberWrap');
      $('#lockPassword').value = '';
      $('#lockPasswordRepeat').value = '';
      if(encrypted){
        $('#lockTitle').textContent = 'Odemknout šifrovaný LifeHub';
        $('#lockIntro').textContent = 'Zadejte heslo. Bez něj se lokální data nenačtou.';
        $('#lockNote').textContent = 'Data aplikace jsou uložená jako AES-GCM šifrovaný blok v localStorage. PDF a dokumenty uložené po odemčení se ukládají šifrovaně v IndexedDB.';
        $('#unlockBtn').textContent = 'Odemknout';
        repeatWrap.classList.add('hide');
        migrateWrap.classList.add('hide');
        $('#wipeEncryptedBtn').classList.remove('hide');
      }else{
        $('#lockTitle').textContent = legacy ? 'Nastavit heslo a převést LifeHub 2.x' : 'Založit šifrovaný LifeHub';
        $('#lockIntro').textContent = legacy ? 'Našel jsem starší nešifrovaná data. Po nastavení hesla je převedu do šifrovaného úložiště.' : 'Nastavte heslo pro nový šifrovaný trezor.';
        $('#lockNote').textContent = 'Heslo se nikam neukládá. Když ho zapomenete, data nepůjde obnovit bez šifrované zálohy a správného hesla.';
        $('#unlockBtn').textContent = legacy ? 'Nastavit heslo a migrovat' : 'Založit trezor';
        repeatWrap.classList.remove('hide');
        migrateWrap.classList.toggle('hide', !legacy);
        $('#wipeEncryptedBtn').classList.add('hide');
      }
      setTimeout(()=>$('#lockPassword')?.focus(), 0);
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
          const envelope = JSON.parse(localStorage.getItem(ENC_STORE));
          vaultSalt = b64ToBytes(envelope.crypto?.salt);
          const storedIterations = Number(envelope.crypto?.iterations) || KDF_ITERATIONS;
          vaultKey = await deriveVaultKey(pass, vaultSalt, storedIterations);
          const plain = await decryptObjectWithKey(envelope, vaultKey);
          state = sanitizeImportedState(plain);
        }else{
          if(pass !== repeat){ $('#lockStatus').textContent = 'Hesla se neshodují.'; return; }
          vaultSalt = window.crypto.getRandomValues(new Uint8Array(16));
          vaultKey = await deriveVaultKey(pass, vaultSalt);
          const legacy = hasLegacyState();
          const migrate = legacy && $('#lockMigrateLegacy')?.checked;
          if(legacy && !migrate){
            const removeLegacy = await confirmDialog('Našel jsem starší nešifrovaná data, ale migrace není zaškrtnutá. Chcete starý nešifrovaný stav odstranit, aby nezůstal v prohlížeči jako plaintext?\n\nVolba „Zrušit“ přeruší založení trezoru a nechá stará data beze změny.', {title:'Starší nešifrovaná data', confirmText:'Smazat starý plaintext', danger:true});
            if(!removeLegacy){ $('#lockStatus').textContent = 'Založení trezoru bylo zrušeno. Starší nešifrovaná data zůstala beze změny.'; vaultKey = null; vaultSalt = null; return; }
            try{ localStorage.removeItem(LEGACY_STORE); }catch(e){ console.warn(e); }
          }
          state = migrate ? sanitizeImportedState(loadLegacyState()) : defaultState();
          state.version = VERSION;
          state.createdAt = state.createdAt || new Date().toISOString();
          await persistEncryptedState();
          if(migrate){
            $('#lockStatus').textContent = 'Převádím starší lokální soubory do šifrovaného úložiště…';
            const migratedFiles = await encryptLegacyFiles();
            console.info(`LifeHub legacy file migration: ${migratedFiles} files processed.`);
          }
        }
        appReady = true;
        $('#lockScreen')?.classList.remove('active');
        document.body.classList.remove('locked');
        setAppInert(false);
        setTheme(state.settings.theme || 'dark');
        hydrateSettings();
        renderAll();
        resetAutoLockTimer();
        $('#saveStatus').textContent = 'Odemčeno';
        toast(encrypted ? 'LifeHub odemčen.' : 'Šifrovaný trezor je připraven.');
      }catch(err){
        console.error(err);
        vaultKey = null; vaultSalt = null; appReady = false;
        $('#lockStatus').textContent = 'Odemčení selhalo. Zkontrolujte heslo.';
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
      ['noteForm','transactionForm','vaultForm','taskForm','shoppingForm'].forEach(id=>{ const form=document.getElementById(id); if(form) form.reset(); });
      ['noteId','transId','vaultId','taskId','shopId'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
      const preview = $('#markdownPreview'); if(preview) preview.textContent = '';
      const search = $('#globalSearch'); if(search) search.value = '';
      const results = $('#globalResults'); if(results) results.innerHTML = '';
      setPdfStatus('Zamčeno','warn');
    }
    async function lockApp(){
      if(!appReady) return;
      $('#saveStatus').textContent = 'Zamykám…';
      try{ await saveInFlight.catch(()=>{}); }catch(e){ console.warn(e); }
      scrubSensitiveRuntime();
      appReady = false;
      vaultKey = null; vaultSalt = null;
      state = defaultState();
      clearTimeout(autoLockTimer);
      $('#saveStatus').textContent = 'Zamčeno';
      $('#lockScreen')?.classList.add('active');
      document.body.classList.add('locked');
      setAppInert(true);
      startSecureGate();
    }
    function resetAutoLockTimer(){
      if(!appReady) return;
      clearTimeout(autoLockTimer);
      autoLockTimer = setTimeout(()=>{ toast('Aplikace byla kvůli neaktivitě zamčena.', 'warn'); lockApp(); }, AUTO_LOCK_MINUTES*60*1000);
    }
    function trapLockFocus(e){
      if($('.modal-screen.active')) return;
      const screen = $('#lockScreen');
      if(!screen?.classList.contains('active')) return;
      if(e.key === 'Escape'){ e.preventDefault(); $('#lockPassword')?.focus(); return; }
      if(e.key !== 'Tab') return;
      const focusables = $$('button,input,select,textarea,a[href]', screen).filter(el=>!el.disabled && !el.classList.contains('hide') && el.offsetParent !== null);
      if(!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length-1];
      if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    }
    async function wipeEncryptedVault(){
      if(!await confirmDialog('Nouzově smazat šifrovaný trezor? Tato akce odstraní šifrovaný stav i lokální PDF/dokumenty. Bez zálohy nepůjde data obnovit.', {title:'Nouzové smazání trezoru', confirmText:'Smazat trezor', danger:true})) return;
      try{ localStorage.removeItem(ENC_STORE); localStorage.removeItem(LEGACY_STORE); await idbClear(PDF_STORE); await idbClear(VAULT_STORE); }catch(e){ console.warn(e); }
      vaultKey = null; vaultSalt = null; appReady = false; state = defaultState();
      $('#lockStatus').textContent = 'Trezor byl smazán. Nyní můžete založit nový.';
      await startSecureGate();
    }
    async function deriveVaultKey(password, salt, iterations = KDF_ITERATIONS) {
      return cryptoDeriveVaultKey(password, salt, iterations);
    }
    async function encryptObjectWithKey(obj, key) {
      return cryptoEncryptObjectWithKey(obj, key);
    }
    async function decryptObjectWithKey(envelope, key) {
      return cryptoDecryptObjectWithKey(envelope, key);
    }
    async function encryptBlobForIdb(file) {
      return cryptoEncryptBlobForIdb(file, vaultKey);
    }
    async function decryptBlobFromIdb(record) {
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
    function renderDashboard(){
      renderSecurityPanel();
      const month = $('#financeMonth')?.value || monthNow();
      const year = Number($('#dashYear')?.value || currentYear());
      const m = monthSummary(month);
      const urgentTasks = state.tasks.filter(t=>!t.done && t.priority==='urgent').length;
      const urgentShop = state.shopping.filter(s=>s.status!=='bought' && s.priority==='urgent').reduce((a,s)=>a+number(s.price),0);
      const balanceClass = m.balance>=0?'money-plus':'money-minus';
      $('#dashboardKpis').innerHTML = [
        kpi('Uložené poznámky', state.notes.length, 'AI vlákna, zdroje a nápady'),
        kpiHtml('Bilance měsíce', `<span class="${balanceClass}">${esc(fmt(m.balance))}</span>`, monthLabel(month)),
        kpi('Nutné úkoly', urgentTasks, 'Nedokončené položky'),
        kpi('Urgentní nákupy', fmt(urgentShop), 'Aktivní plánované výdaje')
      ].join('');
      renderAnnualChart('dashboardFinanceChart', year);
      renderPriorityBars();
      renderGlobalSearch();
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
      panel.innerHTML = `<div class="panel-head"><div><p class="eyebrow">Bezpečnostní stav</p><h3>Šifrovaný LifeHub 3.0</h3><p>Stav aplikace a nově uložené soubory jsou po odemčení chráněné heslem. Po 15 minutách neaktivity se aplikace zamkne.</p></div><div class="actions"><button class="btn ok" data-action="export-encrypted-json" type="button">Šifrovaná záloha</button><button class="btn" data-action="lock-app" type="button">Zamknout</button></div></div><div class="security-list">${items.map(([h,t])=>`<div class="security-item"><strong>${esc(h)}</strong><span class="small">${esc(t)}</span></div>`).join('')}</div>`;
    }
    function renderPriorityBars(){
      const data = [
        ['Nutné úkoly', state.tasks.filter(t=>!t.done && t.priority==='urgent').length, 'high'],
        ['Úkoly tento měsíc', state.tasks.filter(t=>!t.done && t.priority==='month').length, 'mid'],
        ['Dlouhodobé úkoly', state.tasks.filter(t=>!t.done && t.priority==='long').length, 'low'],
        ['Urgentní nákupy', state.shopping.filter(s=>s.status!=='bought' && s.priority==='urgent').length, 'high'],
        ['Nákupy brzy', state.shopping.filter(s=>s.status!=='bought' && s.priority==='soon').length, 'mid'],
        ['Dlouhodobé nákupy', state.shopping.filter(s=>s.status!=='bought' && s.priority==='later').length, 'low']
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
      state.transactions.forEach(t=>{const text=strip([t.category,t.description,t.amount,t.date].join(' ')); if(text.includes(q)) res.push(['Finance',`${t.kind==='income'?'Příjem':'Výdaj'}: ${t.category}`,`${fmt(t.amount)} • ${t.date} • ${t.description||''}`,'finance']);});
      state.payrolls.forEach(p=>{const text=strip([p.month,p.employer,p.note,p.fileName,p.rawText].join(' ')); if(text.includes(q)) res.push(['Výplatní páska',`${p.month} ${p.employer||''}`,`Čistá mzda: ${fmt(p.fields?.netPay || 0)} • ${p.fileName || ''}`,'finance']);});
      state.documents.forEach(d=>{const text=strip([d.title,d.category,d.note,d.fileName].join(' ')); if(text.includes(q)) res.push(['Archiv',d.title,`${docCategoryLabel(d.category)} • ${d.fileName||''}`,'vault']);});
      state.tasks.forEach(t=>{const text=strip([t.title,t.note,t.area,t.priority].join(' ')); if(text.includes(q)) res.push(['Úkol',t.title,`${taskPriorityLabel(t.priority)} • ${t.area||''}`,'tasks']);});
      state.shopping.forEach(s=>{const text=strip([s.name,s.note,s.category,s.priority].join(' ')); if(text.includes(q)) res.push(['Nákup',s.name,`${shopPriorityLabel(s.priority)} • ${fmt(s.price)} • ${s.month||''}`,'shopping']);});
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
      showTab('notes'); $('#noteId').value=n.id; $('#noteTitle').value=n.title; $('#noteSource').value=n.source; $('#notePriority').value=n.priority; $('#noteType').value=n.type;
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
      return `<article class="item"><div class="item-top"><div><h4>${esc(n.title)}</h4><p>${esc(n.summary||'Bez shrnutí')}</p></div><div class="actions"><button class="mini-btn" data-edit-note="${attr(n.id)}" type="button">Upravit</button><button class="mini-btn" data-delete-note="${attr(n.id)}" type="button">Smazat</button></div></div><div class="meta"><span class="priority ${n.priority>=4?'high':n.priority>=3?'mid':'low'}">${stars||'★'} ${esc(n.source)}</span><span class="tag">${esc(n.type)}</span>${n.model?`<span class="tag">${esc(n.model)}</span>`:''}${(n.tags||[]).map(t=>`<span class="tag">#${esc(t)}</span>`).join('')}</div>${n.next?`<p><strong>Další krok:</strong> ${esc(n.next)}</p>`:''}${url?`<p><a href="${attr(url)}" target="_blank" rel="noopener noreferrer">Otevřít zdroj ↗</a></p>`:''}</article>`;
    }
    function populateNoteFilters(){
      const sources=[...new Set(state.notes.map(n=>n.source).filter(Boolean))]; const types=[...new Set(state.notes.map(n=>n.type).filter(Boolean))]; const tags=[...new Set(state.notes.flatMap(n=>n.tags||[]))];
      fillSelect($('#noteSourceFilter'),'Všechny zdroje',sources); fillSelect($('#noteTypeFilter'),'Všechny typy',types); fillSelect($('#noteTagFilter'),'Všechny tagy',tags);
    }
    function fillSelect(sel,label,items,values=null){if(!sel)return; const old=sel.value; const entries=items.map((item,i)=>({label:String(item),value:String(values?values[i]:item)})).sort((a,b)=>a.label.localeCompare(b.label,'cs')); sel.innerHTML=`<option value="all">${label}</option>`+entries.map(x=>`<option value="${esc(x.value)}">${esc(x.label)}</option>`).join(''); sel.value=[...sel.options].some(o=>o.value===old)?old:'all';}

    function renderPayrollFieldInputs(){
      $('#payrollFields').innerHTML = payFieldDefs.map(([key,label])=>`<label>${esc(label)}<input id="pay_${key}" data-pay-field="${attr(key)}" type="number" step="0.01" placeholder="nenalezeno"><small class="small" id="payproof_${attr(key)}">Bez důkazu z PDF.</small></label>`).join('');
    }
    function setPdfStatus(text, cls='warn'){const el=$('#pdfStatus'); el.textContent=text; el.className=`status ${cls}`;}
    async function parsePayrollPdf(){
      const file = $('#payrollPdf').files[0];
      if(!file){toast('Nejdřív vyberte PDF výplatní pásku.','warn'); return;}
      currentPayroll.file = file; currentPayroll.text=''; currentPayroll.parsed={};
      setPdfStatus('Čtu PDF…','warn'); $('#payrollRawText').textContent='Probíhá čtení PDF…';
      try{
        const text = await extractPdfText(file);
        currentPayroll.text = text;
        $('#payrollRawText').textContent = text || 'PDF neobsahuje čitelnou textovou vrstvu.';
        const parsed = parsePayrollText(text);
        currentPayroll.parsed = parsed.fields;
        currentPayroll.evidence = parsed.evidence || {};
        fillPayrollFields(parsed.fields, parsed.evidence);
        if(text.trim().length < 80){
          setPdfStatus('Pravděpodobně sken bez OCR','bad');
          toast('PDF skoro neobsahuje text. U skenu je potřeba OCR nebo ruční zadání hodnot.','bad');
        }else if(parsed.found >= 5){
          setPdfStatus(`Rozpoznáno ${parsed.found} hodnot`, 'good'); toast('PDF přečteno. Zkontrolujte nalezené částky a uložte pásku.');
        }else{
          setPdfStatus(`Rozpoznáno jen ${parsed.found} hodnot`, 'warn'); toast('PDF přečteno, ale některé hodnoty chybí. Doplňte je ručně.','warn');
        }
      }catch(err){console.error(err); setPdfStatus('Čtení PDF selhalo','bad'); $('#payrollRawText').textContent=String(err.message||err); toast('PDF se nepodařilo přečíst. Zkuste jiné PDF nebo ruční zadání.','bad');}
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
      currentPayroll = {file:null,text:'',parsed:{},evidence:{}}; $('#payrollPdf').value=''; $('#payrollRawText').textContent='Zatím není načteno žádné PDF.'; $('#payStorePdf').checked = false; $('#payStoreText').checked = false; fillPayrollFields({}); setPdfStatus('PDF čeká na načtení','warn');
    }
    async function savePayrollRecord(){
      const fields = readPayrollFields(); const month = $('#payMonth').value;
      if(!month){toast('Vyberte měsíc výplaty.','warn'); return;}
      if(!fields.netPay && !fields.grossPay){toast('Doplňte alespoň čistou nebo hrubou mzdu.','warn'); return;}
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
      const record = {id, month, employer:$('#payEmployer').value.trim(), note:$('#payNote').value.trim(), fileName:currentPayroll.file?.name||'', fileSize:currentPayroll.file?.size||0, fields, evidence: sanitizeEvidence(currentPayroll.evidence || {}), rawText: $('#payStoreText').checked ? currentPayroll.text : '', storedPdf:false, createdAt:new Date().toISOString()};
      if($('#payStorePdf').checked && currentPayroll.file){
        try{ await idbPut(id,currentPayroll.file); record.storedPdf=true; }
        catch(e){ console.error(e); toast('PDF se nepodařilo uložit do IndexedDB. Ukládám alespoň vyčtené částky bez PDF kopie.','warn'); }
      }
      if($('#payReplaceMonth').checked){
        state.transactions = state.transactions.filter(t=>!(t.source==='payroll' && t.payrollMonth===month));
      }
      state.payrolls.unshift(record);
      state.transactions.unshift({id:uid('trans'), date:`${month}-01`, kind:'income', category:'mzda', amount:fields.netPay || fields.grossPay || 0, description:`Výplatní páska${record.employer?' • '+record.employer:''}${record.fileName?' • '+record.fileName:''}`, source:'payroll', payrollId:id, payrollMonth:month, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString()});
      save(); clearPayrollImport(); toast('Výplatní páska uložena a čistá mzda zapsána do příjmů.');
    }
    function monthSummary(month){
      const ts=state.transactions.filter(t=>t.date?.startsWith(month));
      const income=ts.filter(t=>t.kind==='income').reduce((a,t)=>a+number(t.amount),0);
      const expense=ts.filter(t=>t.kind==='expense').reduce((a,t)=>a+number(t.amount),0);
      return {income,expense,balance:income-expense,count:ts.length};
    }
    function yearMonthData(year){
      return Array.from({length:12},(_,i)=>{
        const m=`${year}-${pad(i+1)}`; const s=monthSummary(m); return {month:m,label:new Date(`${m}-01`).toLocaleDateString('cs-CZ',{month:'short'}),...s};
      });
    }
    function renderFinance(){
      const month=$('#financeMonth').value || monthNow(); const year=Number($('#financeYear').value||currentYear());
      const m=monthSummary(month), goal=number(state.settings.savingGoal);
      $('#financeKpis').innerHTML = [kpi('Příjmy',fmt(m.income),monthLabel(month)), kpi('Výdaje',fmt(m.expense),`${m.count} transakcí`), kpiHtml('Bilance',`<span class="${m.balance>=0?'money-plus':'money-minus'}">${esc(fmt(m.balance))}</span>`, goal?`Cíl úspory: ${fmt(goal)}`:'Bez cíle úspory'), kpi('Výplatní pásky',state.payrolls.length,'Uložené záznamy')].join('');
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
      const exp=state.transactions.filter(t=>t.kind==='expense'&&t.date?.startsWith(month)); const groups={}; exp.forEach(t=>groups[t.category||'bez kategorie']=(groups[t.category||'bez kategorie']||0)+number(t.amount));
      const arr=Object.entries(groups).sort((a,b)=>b[1]-a[1]); const max=Math.max(1,...arr.map(x=>x[1]));
      $('#expenseBars').innerHTML=arr.map(([k,v])=>barRow(k,fmt(v),Math.round(v/max*100))).join('') || empty('Ve vybraném měsíci zatím nejsou výdaje.');
    }
    function clampPercent(pct,min=3){ return Math.max(min, Math.min(100, Math.round(Number(pct)||0))); }
    function barRow(label,value,pct){return `<div class="bar-row"><div class="bar-row-head"><span>${esc(label)}</span><span>${esc(value)}</span></div><div class="bar-bg"><div class="bar-fill w-${clampPercent(pct)}"></div></div></div>`;}
    function renderPayrollForecast(){
      const records=state.payrolls.filter(p=>number(p.fields?.netPay)>0).sort((a,b)=>b.month.localeCompare(a.month));
      if(!records.length){$('#payrollForecast').innerHTML=empty('Po načtení prvních výplatních pásek se zde zobrazí odhad další čisté mzdy a průměr odvodů.');return;}
      const avg = arr => arr.reduce((a,b)=>a+b,0)/Math.max(1,arr.length);
      const last3=records.slice(0,3), last6=records.slice(0,6);
      const avg3=avg(last3.map(p=>number(p.fields.netPay))), avg6=avg(last6.map(p=>number(p.fields.netPay)));
      const tax=avg(records.slice(0,6).map(p=>number(p.fields.incomeTax))); const soc=avg(records.slice(0,6).map(p=>number(p.fields.socialInsurance))); const health=avg(records.slice(0,6).map(p=>number(p.fields.healthInsurance)));
      $('#payrollForecast').innerHTML=`<div class="kpis kpis-two compact-kpis"><div class="kpi"><div class="label">Odhad příští čisté mzdy</div><div class="value">${fmt(avg3||avg6)}</div><div class="sub">Průměr posledních ${last3.length} pásek</div></div><div class="kpi"><div class="label">Roční odhad čistého příjmu</div><div class="value">${fmt((avg6||avg3)*12)}</div><div class="sub">Podle průměru posledních ${last6.length} pásek</div></div></div><div class="spacer-12"></div><div class="bar-list">${barRow('Průměrná záloha na daň',fmt(tax),Math.min(100,tax/Math.max(1,avg6)*100))}${barRow('Průměrné sociální pojištění',fmt(soc),Math.min(100,soc/Math.max(1,avg6)*100))}${barRow('Průměrné zdravotní pojištění',fmt(health),Math.min(100,health/Math.max(1,avg6)*100))}</div>`;
    }
    function saveTransaction(e){
      e.preventDefault(); const id=$('#transId').value||uid('trans'); const existing=state.transactions.find(t=>t.id===id);
      const t={id,date:$('#transDate').value,kind:$('#transKind').value,category:$('#transCategory').value.trim(),amount:number($('#transAmount').value),description:$('#transDescription').value.trim(),source:existing?.source||'manual',createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
      if(existing) Object.assign(existing,t); else state.transactions.unshift(t); save(); resetTransactionForm(); toast('Transakce uložena.');
    }
    function resetTransactionForm(){ $('#transactionForm').reset(); $('#transId').value=''; $('#transDate').value=today(); }
    function editTransactionForm(id){const t=state.transactions.find(x=>x.id===id); if(!t)return; showTab('finance'); $('#transId').value=t.id; $('#transDate').value=t.date; $('#transKind').value=t.kind; $('#transCategory').value=t.category; $('#transAmount').value=t.amount; $('#transDescription').value=t.description||'';}
    function renderTransactions(){
      const q=strip($('#transSearch')?.value||''), kind=$('#transKindFilter')?.value||'all', source=$('#transSourceFilter')?.value||'all', period=$('#transPeriodFilter')?.value||'selected';
      const month=$('#financeMonth').value, year=$('#financeYear').value;
      let arr=state.transactions.filter(t=>{
        const inPeriod = period==='all' ? true : period==='year' ? t.date?.startsWith(year+'-') : t.date?.startsWith(month);
        return inPeriod && (kind==='all'||t.kind===kind) && (source==='all'||t.source===source) && (!q || strip([t.category,t.description,t.amount,t.date].join(' ')).includes(q));
      }).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
      $('#transactionsList').innerHTML=arr.map(t=>`<article class="item"><div class="item-top"><div><h4>${t.kind==='income'?'Příjem':'Výdaj'} • ${esc(t.category)}</h4><p>${esc(t.date)} • <strong class="${t.kind==='income'?'money-plus':'money-minus'}">${fmt(t.amount)}</strong> ${t.source==='payroll'?'• z výplatní pásky':''}</p>${t.description?`<p>${esc(t.description)}</p>`:''}</div><div class="actions"><button class="mini-btn" data-edit-trans="${attr(t.id)}" type="button">Upravit</button><button class="mini-btn" data-delete-trans="${attr(t.id)}" type="button">Smazat</button></div></div></article>`).join('') || empty('Žádné transakce pro aktuální filtr.');
    }
    function renderPayrollList(){
      $('#payrollList').innerHTML=state.payrolls.map(p=>`<article class="item"><div class="item-top"><div><h4>${esc(monthLabel(p.month))}${p.employer?' • '+esc(p.employer):''}</h4><p><strong>Čistá mzda:</strong> ${fmt(p.fields?.netPay||0)} • <strong>Hrubá:</strong> ${fmt(p.fields?.grossPay||0)} • <strong>Daň:</strong> ${fmt(p.fields?.incomeTax||0)}</p><div class="meta"><span class="tag">${esc(p.fileName||'bez názvu PDF')}</span>${p.storedPdf?'<span class="status good">PDF uloženo lokálně</span>':'<span class="status warn">PDF neuloženo</span>'}</div>${p.note?`<p>${esc(p.note)}</p>`:''}</div><div class="actions">${p.storedPdf?`<button class="mini-btn" data-download-payroll="${attr(p.id)}" type="button">Stáhnout PDF</button><button class="mini-btn" data-purge-payroll-pdf="${attr(p.id)}" type="button">Smazat jen PDF</button>`:''}<button class="mini-btn" data-delete-payroll="${attr(p.id)}" type="button">Smazat</button></div></div></article>`).join('') || empty('Zatím nejsou uložené výplatní pásky.');
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
    function openDb(){return new Promise((res,rej)=>{const r=indexedDB.open(PDF_DB,3); r.onupgradeneeded=()=>{const db=r.result; if(!db.objectStoreNames.contains(PDF_STORE)) db.createObjectStore(PDF_STORE); if(!db.objectStoreNames.contains(VAULT_STORE)) db.createObjectStore(VAULT_STORE);}; r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error);});}
    function txDone(tx){return new Promise((res,rej)=>{tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error); tx.onabort=()=>rej(tx.error||new Error('Transakce byla přerušena.'));});}
    async function idbRawPut(id,value,store=PDF_STORE){const db=await openDb(); const tx=db.transaction(store,'readwrite'); tx.objectStore(store).put(value,id); await txDone(tx);}
    async function idbRawGet(id,store=PDF_STORE){const db=await openDb(); return new Promise((res,rej)=>{const tx=db.transaction(store,'readonly'); const r=tx.objectStore(store).get(id); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error);});}
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
    async function idbDelete(id,store=PDF_STORE){const db=await openDb(); const tx=db.transaction(store,'readwrite'); tx.objectStore(store).delete(id); await txDone(tx);}

    async function idbClear(store){const db=await openDb(); const tx=db.transaction(store,'readwrite'); tx.objectStore(store).clear(); await txDone(tx);}


    function resetVaultForm(){ $('#vaultId').value=''; $('#vaultTitle').value=''; $('#vaultCategory').value='jine'; $('#vaultDate').value=today(); $('#vaultFile').value=''; $('#vaultNote').value=''; }
    async function saveVaultDoc(e){
      e.preventDefault();
      const id = $('#vaultId').value || uid('doc');
      const file = $('#vaultFile').files[0];
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
        if(file) await idbPut(id, file, VAULT_STORE);
        state.documents = [meta, ...state.documents.filter(d=>d.id!==id)];
        save(); resetVaultForm(); toast('Dokument uložen v šifrovaném trezoru.');
      }catch(err){ console.error(err); toast('Soubor se nepodařilo uložit do šifrovaného trezoru.','bad'); }
    }
    function renderVault(){
      populateVaultFilters();
      const q=strip($('#vaultSearch')?.value||''), cat=$('#vaultCategoryFilter')?.value||'all', sort=$('#vaultSort')?.value||'new';
      let arr=state.documents.filter(d=>(cat==='all'||d.category===cat)&&(!q||strip([d.title,d.category,d.note,d.fileName].join(' ')).includes(q)));
      arr.sort((a,b)=> sort==='title'?String(a.title).localeCompare(String(b.title),'cs'):sort==='category'?String(a.category).localeCompare(String(b.category),'cs'):new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt));
      $('#vaultList').innerHTML=arr.map(d=>`<article class="item"><div class="item-top"><div><h4>${esc(d.title)}</h4><p><strong>${esc(docCategoryLabel(d.category))}</strong> • ${esc(d.date||'bez data')} • ${esc(d.fileName||'bez názvu souboru')} • ${formatBytes(d.size)}</p>${d.note?`<p>${esc(d.note)}</p>`:''}<div class="meta"><span class="status good">uloženo lokálně</span><span class="tag">${esc(d.mime||'soubor')}</span></div></div><div class="actions"><button class="mini-btn" data-download-doc="${attr(d.id)}" type="button">Stáhnout</button><button class="mini-btn" data-delete-doc="${attr(d.id)}" type="button">Smazat</button></div></div></article>`).join('') || empty('Archiv je zatím prázdný.');
    }
    function populateVaultFilters(){ if(!$('#vaultCategoryFilter')) return; fillSelect($('#vaultCategoryFilter'),'Všechny typy',[...new Set(state.documents.map(d=>d.category).filter(Boolean))].map(docCategoryLabel), [...new Set(state.documents.map(d=>d.category).filter(Boolean))]); }
    function docCategoryLabel(c){return {'vyplatni-paska':'Výplatní páska','finance':'Finance','skola':'Škola/práce','smlouva':'Smlouva','faktura':'Faktura','export':'Export / AI výstup','jine':'Jiné'}[c] || c || 'Jiné';}
    function formatBytes(bytes){ const n=Number(bytes)||0; if(n<1024) return `${n} B`; if(n<1024*1024) return `${(n/1024).toFixed(1)} kB`; return `${(n/1024/1024).toFixed(1)} MB`; }
    async function downloadVaultDoc(id){ try{const file=await idbGet(id, VAULT_STORE); const meta=state.documents.find(d=>d.id===id); if(!file){toast('Soubor v lokálním úložišti nenalezen.','bad');return;} download(meta?.fileName || file.name || `dokument-${id}`, file, file.type||meta?.mime||'application/octet-stream');}catch(e){toast('Soubor se nepodařilo stáhnout.','bad');} }
    async function deleteVaultDoc(id){
      if(!await confirmDialog('Opravdu smazat dokument z šifrovaného trezoru?', {title:'Smazat dokument', confirmText:'Smazat', danger:true})) return;
      try{await idbDelete(id, VAULT_STORE);}
      catch(err){ console.error(err); toast('Soubor se nepodařilo smazat z IndexedDB, metadata zůstala beze změny.','bad'); return; }
      state.documents=state.documents.filter(d=>d.id!==id); save(); toast('Dokument smazán z archivu.','warn');
    }
    async function requestPersistentStorage(){
      if(!navigator.storage?.persist){ toast('Tento prohlížeč neumí ručně požádat o trvalé úložiště.','warn'); return; }
      try{ const granted = await navigator.storage.persist(); toast(granted ? 'Prohlížeč povolil trvalejší lokální úložiště.' : 'Prohlížeč trvalejší úložiště nepotvrdil. Zálohy dál stahujte ručně.', granted?'good':'warn'); }
      catch(e){ toast('Žádost o trvalé úložiště selhala.','warn'); }
    }

    function saveTask(e){e.preventDefault(); const id=$('#taskId').value||uid('task'); const existing=state.tasks.find(t=>t.id===id); const t={id,title:$('#taskTitle').value.trim(),priority:$('#taskPriority').value,due:$('#taskDue').value,area:$('#taskArea').value.trim(),note:$('#taskNote').value.trim(),done:existing?.done||false,createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()}; if(existing)Object.assign(existing,t); else state.tasks.unshift(t); save(); resetTaskForm(); toast('Úkol uložen.');}
    function resetTaskForm(){ $('#taskForm').reset(); $('#taskId').value=''; }
    function editTaskForm(id){const t=state.tasks.find(x=>x.id===id); if(!t)return; showTab('tasks'); $('#taskId').value=t.id; $('#taskTitle').value=t.title; $('#taskPriority').value=t.priority; $('#taskDue').value=t.due||''; $('#taskArea').value=t.area||''; $('#taskNote').value=t.note||'';}
    function toggleTaskDone(id){const t=state.tasks.find(x=>x.id===id); if(t){t.done=!t.done;t.updatedAt=new Date().toISOString();save();}}
    function renderTasks(){
      populateTaskFilters(); const q=strip($('#taskSearch')?.value||''), status=$('#taskStatusFilter')?.value||'open', area=$('#taskAreaFilter')?.value||'all', sort=$('#taskSort')?.value||'priority';
      let arr=state.tasks.filter(t=>(status==='all'||(status==='done'?t.done:!t.done))&&(area==='all'||t.area===area)&&(!q||strip([t.title,t.note,t.area].join(' ')).includes(q)));
      const lanes=[['urgent','🔥 Nutné'],['month','📅 Tento měsíc'],['long','🌱 Dlouhodobé']];
      $('#taskBoard').innerHTML=lanes.map(([key,label])=>{let items=arr.filter(t=>t.priority===key); items.sort((a,b)=>sort==='due'?String(a.due||'9999').localeCompare(String(b.due||'9999')):sort==='new'?new Date(b.createdAt)-new Date(a.createdAt):0); return `<div class="lane"><h3>${label}<span class="tag">${items.length}</span></h3>${items.map(taskCard).join('')||'<div class="empty">Prázdné</div>'}</div>`}).join('');
    }
    function taskCard(t){return `<article class="task ${t.done?'done':''}"><div class="checkline"><input type="checkbox" data-toggle-task="${attr(t.id)}" ${t.done?'checked':''}><div><h4>${esc(t.title)}</h4><p>${esc(t.area||'bez oblasti')}${t.due?' • termín '+esc(t.due):''}</p>${t.note?`<p>${esc(t.note)}</p>`:''}</div></div><div class="actions"><button class="mini-btn" data-edit-task="${attr(t.id)}" type="button">Upravit</button><button class="mini-btn" data-delete-task="${attr(t.id)}" type="button">Smazat</button></div></article>`;}
    function populateTaskFilters(){fillSelect($('#taskAreaFilter'),'Všechny oblasti',[...new Set(state.tasks.map(t=>t.area).filter(Boolean))]);}
    function taskPriorityLabel(p){return p==='urgent'?'Nutné':p==='month'?'Tento měsíc':'Dlouhodobé';}

    function saveShopping(e){e.preventDefault(); const id=$('#shopId').value||uid('shop'); const existing=state.shopping.find(s=>s.id===id); const s={id,name:$('#shopName').value.trim(),priority:$('#shopPriority').value,status:$('#shopStatus').value,category:$('#shopCategory').value.trim(),price:number($('#shopPrice').value),month:$('#shopMonth').value,url:safeUrl($('#shopUrl').value),note:$('#shopNote').value.trim(),createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()}; if(existing)Object.assign(existing,s); else state.shopping.unshift(s); save(); resetShoppingForm(); toast('Nákup uložen.');}
    function resetShoppingForm(){ $('#shoppingForm').reset(); $('#shopId').value=''; $('#shopMonth').value=monthNow(); }
    function editShoppingForm(id){const s=state.shopping.find(x=>x.id===id); if(!s)return; showTab('shopping'); $('#shopId').value=s.id; $('#shopName').value=s.name; $('#shopPriority').value=s.priority; $('#shopStatus').value=s.status; $('#shopCategory').value=s.category||''; $('#shopPrice').value=s.price||''; $('#shopMonth').value=s.month||''; $('#shopUrl').value=s.url||''; $('#shopNote').value=s.note||'';}
    function renderShopping(){
      populateShoppingFilters(); const year=Number($('#shoppingYear')?.value||currentYear());
      const active=state.shopping.filter(s=>s.status!=='bought'); const urgent=active.filter(s=>s.priority==='urgent').reduce((a,s)=>a+number(s.price),0); const thisMonth=active.filter(s=>s.month===$('#financeMonth').value).reduce((a,s)=>a+number(s.price),0); const yearTotal=active.filter(s=>s.month?.startsWith(year+'-')).reduce((a,s)=>a+number(s.price),0);
      $('#shoppingKpis').innerHTML=[kpi('Aktivní položky',active.length,'Plánované a odložené'),kpi('Urgentní nákupy',fmt(urgent),'Součet cen'),kpi('Tento měsíc',fmt(thisMonth),monthLabel($('#financeMonth').value)),kpi('Roční plán',fmt(yearTotal),String(year))].join('');
      renderShoppingChart(year); renderShoppingList();
    }
    function renderShoppingChart(year){
      const months=Array.from({length:12},(_,i)=>`${year}-${pad(i+1)}`); const values=months.map(m=>state.shopping.filter(s=>s.status!=='bought'&&s.month===m).reduce((a,s)=>a+number(s.price),0)); const max=Math.max(1,...values); const w=760,h=250,p=34; let svg=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Roční nákupní plán"><defs><linearGradient id="gShop" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#f43f8b"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs>`; for(let i=0;i<5;i++){const gy=p+i*(h-p*2)/4;svg+=`<line x1="${p}" y1="${gy}" x2="${w-p}" y2="${gy}" stroke="var(--chart-grid)"/>`;} values.forEach((v,i)=>{const x=p+i*((w-p*2)/12)+12,bw=32,bh=Math.max(2,(v/max)*(h-p*2));svg+=`<rect x="${x}" y="${h-p-bh}" width="${bw}" height="${bh}" rx="9" fill="url(#gShop)"><title>${months[i]}: ${fmt(v)}</title></rect><text x="${x+bw/2}" y="${h-10}" text-anchor="middle" fill="var(--muted)" font-size="11">${i+1}</text>`}); svg+='</svg>'; $('#shoppingChart').innerHTML=svg;
    }
    function renderShoppingList(){
      const q=strip($('#shopSearch')?.value||''), pri=$('#shopPriorityFilter')?.value||'all', stat=$('#shopStatusFilter')?.value||'open', cat=$('#shopCategoryFilter')?.value||'all', sort=$('#shopSort')?.value||'priority';
      const order={urgent:0,soon:1,later:2};
      let arr=state.shopping.filter(s=>(pri==='all'||s.priority===pri)&&(cat==='all'||s.category===cat)&&(stat==='all'||(stat==='open'?s.status!=='bought':s.status===stat))&&(!q||strip([s.name,s.note,s.category].join(' ')).includes(q)));
      arr.sort((a,b)=> sort==='priority'?order[a.priority]-order[b.priority]: sort==='month'?String(a.month||'9999').localeCompare(String(b.month||'9999')): sort==='price'?number(b.price)-number(a.price):new Date(b.createdAt)-new Date(a.createdAt));
      $('#shoppingList').innerHTML=arr.map(s=>`<article class="item"><div class="item-top"><div><h4>${esc(s.name)}</h4><p><strong>${fmt(s.price)}</strong> • ${shopPriorityLabel(s.priority)} • ${esc(s.month?monthLabel(s.month):'bez měsíce')} • ${esc(s.category||'bez kategorie')}</p>${s.note?`<p>${esc(s.note)}</p>`:''}<div class="meta"><span class="priority ${s.priority==='urgent'?'high':s.priority==='soon'?'mid':'low'}">${shopPriorityLabel(s.priority)}</span><span class="tag">${shopStatusLabel(s.status)}</span>${s.url?`<a class="tag" href="${attr(safeUrl(s.url))}" target="_blank" rel="noopener">odkaz ↗</a>`:''}</div></div><div class="actions"><button class="mini-btn" data-edit-shop="${attr(s.id)}" type="button">Upravit</button><button class="mini-btn" data-delete-shop="${attr(s.id)}" type="button">Smazat</button></div></div></article>`).join('') || empty('Žádné nákupy pro aktuální filtr.');
    }
    function populateShoppingFilters(){fillSelect($('#shopCategoryFilter'),'Všechny kategorie',[...new Set(state.shopping.map(s=>s.category).filter(Boolean))]);}
    function shopPriorityLabel(p){return p==='urgent'?'Urgentní':p==='soon'?'Brzy':'Dlouhodobé';}
    function shopStatusLabel(s){return s==='bought'?'Koupeno':s==='paused'?'Odloženo':'Plánováno';}

    function bytesToB64(bytes) {
      return cryptoBytesToB64(bytes);
    }
    function b64ToBytes(b64) {
      return cryptoB64ToBytes(b64);
    }
    async function deriveBackupKey(passphrase, salt, iterations = KDF_ITERATIONS) {
      return cryptoDeriveBackupKey(passphrase, salt, iterations);
    }
    async function encryptBackupObject(obj, passphrase) {
      return cryptoEncryptBackupObject(obj, passphrase);
    }
    async function decryptBackupObject(obj, passphrase) {
      return cryptoDecryptBackupObject(obj, passphrase);
    }

    async function exportEncryptedJson(){
      try{
        if(!window.crypto?.subtle){ toast('Šifrovaný export vyžaduje Web Crypto API a bezpečný kontext.', 'bad'); return; }
        const pass = await passwordDialog({title:'Heslo pro šifrovanou zálohu', message:'Zadejte heslo pro šifrovanou zálohu. Heslo se nikam neukládá a bez něj zálohu nepůjde obnovit.', repeat:true, minLength:MIN_PASSWORD_LENGTH, confirmText:'Vytvořit zálohu'});
        if(!pass) return;
        const encrypted = await encryptBackupObject(state, pass);
        download(`lifehub-sifrovana-zaloha-${today()}.json`, JSON.stringify(encrypted,null,2),'application/json;charset=utf-8');
        toast('Šifrovaná JSON záloha byla vytvořena. Bez hesla ji nepůjde obnovit.');
      }catch(err){ console.error(err); toast('Šifrovanou zálohu se nepodařilo vytvořit: '+(err.message||err), 'bad'); }
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
    function sanitizeImportedState(data){
      if(!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Záloha nemá očekávaný formát.');
      const approxSize = new Blob([JSON.stringify(data)]).size;
      if(approxSize > 8 * 1024 * 1024) throw new Error('Záloha je příliš velká pro bezpečný import.');
      if(hasForbiddenKeys(data)) throw new Error('Záloha obsahuje zakázané klíče a nebude importována.');
      const clean = defaultState();
      const st = data.settings || {};
      clean.settings = {
        theme:['dark','light'].includes(st.theme) ? st.theme : 'dark',
        ownerName:textLimit(st.ownerName,180) || clean.settings.ownerName,
        ownerFooter:textLimit(st.ownerFooter,260) || clean.settings.ownerFooter,
        currency:sanitizeCurrency(st.currency),
        savingGoal:Math.max(0, number(st.savingGoal))
      };
      const asArray=(value,max)=>Array.isArray(value)?value.slice(0,max):[];
      clean.notes = asArray(data.notes,5000).map(n=>({
        id:safeId(n?.id,'note'), title:textLimit(n?.title,180), source:textLimit(n?.source,40)||'Vlastní', priority:Math.min(5,Math.max(1,Number(n?.priority)||3)), type:textLimit(n?.type,40)||'jiné', model:textLimit(n?.model,80), url:safeUrl(n?.url), tags:sanitizeTags(n?.tags), summary:textLimit(n?.summary,3000), content:textLimit(n?.content,50000), next:textLimit(n?.next,1000), createdAt:textLimit(n?.createdAt,40)||new Date().toISOString(), updatedAt:textLimit(n?.updatedAt,40)||new Date().toISOString()
      })).filter(n=>n.title || n.summary || n.content);
      clean.transactions = asArray(data.transactions,10000).map(t=>({
        id:safeId(t?.id,'trans'), date:textLimit(t?.date,10), kind:t?.kind==='expense'?'expense':'income', category:textLimit(t?.category,80)||'bez kategorie', amount:Math.max(0, number(t?.amount)), description:textLimit(t?.description,1000), source:t?.source==='payroll'?'payroll':'manual', payrollId:textLimit(t?.payrollId,100), payrollMonth:textLimit(t?.payrollMonth,7), createdAt:textLimit(t?.createdAt,40)||new Date().toISOString(), updatedAt:textLimit(t?.updatedAt,40)||new Date().toISOString()
      })).filter(t=>/^\d{4}-\d{2}-\d{2}$/.test(t.date));
      clean.payrolls = asArray(data.payrolls,1000).map(p=>({
        id:safeId(p?.id,'payroll'), month:textLimit(p?.month,7), employer:textLimit(p?.employer,160), note:textLimit(p?.note,1000), fileName:textLimit(p?.fileName,220), fileSize:Math.max(0, number(p?.fileSize)), fields:sanitizePayrollFields(p?.fields||{}), evidence:sanitizeEvidence(p?.evidence), rawText:textLimit(p?.rawText,200000), storedPdf:false, createdAt:textLimit(p?.createdAt,40)||new Date().toISOString(), updatedAt:textLimit(p?.updatedAt,40)||''
      })).filter(p=>/^\d{4}-\d{2}$/.test(p.month));
      clean.documents = asArray(data.documents,3000).map(d=>({
        id:safeId(d?.id,'doc'), title:textLimit(d?.title,180)||'Dokument', category:textLimit(d?.category,50)||'jine', date:textLimit(d?.date,10), note:textLimit(d?.note,1000), fileName:textLimit(d?.fileName,220), mime:textLimit(d?.mime,120)||'application/octet-stream', size:Math.max(0, number(d?.size)), createdAt:textLimit(d?.createdAt,40)||new Date().toISOString(), updatedAt:textLimit(d?.updatedAt,40)||new Date().toISOString(), storedFile:false
      }));
      clean.tasks = asArray(data.tasks,5000).map(t=>({
        id:safeId(t?.id,'task'), title:textLimit(t?.title,180), priority:['urgent','month','long'].includes(t?.priority)?t.priority:'month', due:textLimit(t?.due,10), area:textLimit(t?.area,80), note:textLimit(t?.note,1000), done:!!t?.done, createdAt:textLimit(t?.createdAt,40)||new Date().toISOString(), updatedAt:textLimit(t?.updatedAt,40)||new Date().toISOString()
      })).filter(t=>t.title);
      clean.shopping = asArray(data.shopping,5000).map(sh=>({
        id:safeId(sh?.id,'shop'), name:textLimit(sh?.name,180), priority:['urgent','soon','later'].includes(sh?.priority)?sh.priority:'soon', status:['planned','bought','paused'].includes(sh?.status)?sh.status:'planned', category:textLimit(sh?.category,80), price:Math.max(0, number(sh?.price)), month:textLimit(sh?.month,7), url:safeUrl(sh?.url), note:textLimit(sh?.note,1000), createdAt:textLimit(sh?.createdAt,40)||new Date().toISOString(), updatedAt:textLimit(sh?.updatedAt,40)||new Date().toISOString()
      })).filter(sh=>sh.name);
      clean.createdAt = textLimit(data.createdAt,40) || clean.createdAt;
      clean.updatedAt = new Date().toISOString();
      clean.version = VERSION;
      return clean;
    }
    function confirmPrivateExport(label='Soukromý export'){
      return confirmDialog(`${label} může obsahovat citlivá data, osobní finance, URL, poznámky nebo extrahovaný text z PDF. Pro sdílení použijte anonymizovaný export nebo šifrovanou zálohu. Opravdu pokračovat?`, {title:'Soukromý export', confirmText:'Exportovat'});
    }
    async function exportJson(){
      if(!await confirmPrivateExport('Nešifrovaný JSON export')) return;
      download(`lifehub-nesifrovana-zaloha-${today()}.json`, JSON.stringify(state,null,2),'application/json;charset=utf-8');
    }
    async function exportHtml(){if(!await confirmPrivateExport('Soukromý HTML přehled')) return; const html=`<!doctype html><html lang="cs"><meta charset="utf-8"><title>LifeHub export</title><body>${buildMarkdown().split('\n').map(line=>line.startsWith('#')?`<h${Math.min(6,(line.match(/^#+/)?.[0].length||1))}>${esc(line.replace(/^#+\s*/,''))}</h${Math.min(6,(line.match(/^#+/)?.[0].length||1))}>`:line?`<p>${esc(line)}</p>`:'').join('\n')}</body></html>`; download(`lifehub-prehled-${today()}.html`, html, 'text/html;charset=utf-8');}
    async function exportCsv(kind){
      if(!await confirmPrivateExport(`CSV export: ${kind}`)) return;
      const maps={
        notes:[['id','title','source','type','priority','model','url','tags','summary','content','next','createdAt','updatedAt'], ...state.notes.map(n=>[n.id,n.title,n.source,n.type,n.priority,n.model,n.url,(n.tags||[]).join('; '),n.summary,n.content,n.next,n.createdAt,n.updatedAt])],
        transactions:[['id','date','kind','category','amount','description','source','payrollMonth'], ...state.transactions.map(t=>[t.id,t.date,t.kind,t.category,t.amount,t.description,t.source,t.payrollMonth||''])],
        payrolls:[['id','month','employer','fileName','netPay','grossPay','taxBase','incomeTax','taxpayerDiscount','childDiscount','socialInsurance','healthInsurance','deductions','bonus','note','storedPdf'], ...state.payrolls.map(p=>[p.id,p.month,p.employer,p.fileName,p.fields?.netPay,p.fields?.grossPay,p.fields?.taxBase,p.fields?.incomeTax,p.fields?.taxpayerDiscount,p.fields?.childDiscount,p.fields?.socialInsurance,p.fields?.healthInsurance,p.fields?.deductions,p.fields?.bonus,p.note,p.storedPdf])],
        tasks:[['id','title','priority','due','area','note','done','createdAt'], ...state.tasks.map(t=>[t.id,t.title,t.priority,t.due,t.area,t.note,t.done,t.createdAt])],
        shopping:[['id','name','priority','status','category','price','month','url','note','createdAt'], ...state.shopping.map(s=>[s.id,s.name,s.priority,s.status,s.category,s.price,s.month,s.url,s.note,s.createdAt])],
        documents:[['id','title','category','date','fileName','mime','size','note','createdAt','updatedAt'], ...state.documents.map(d=>[d.id,d.title,d.category,d.date,d.fileName,d.mime,d.size,d.note,d.createdAt,d.updatedAt])]
      };
      download(`lifehub-${kind}-${today()}.csv`, csv(maps[kind]), 'text/csv;charset=utf-8');
    }
    function notesMarkdown(){return ['# Poznámky LifeHub',...state.notes.map(n=>`\n## ${n.title}\n- Zdroj: ${n.source}\n- Typ: ${n.type}\n- Priorita: ${n.priority}/5\n- Model: ${n.model||''}\n- URL: ${n.url||''}\n- Tagy: ${(n.tags||[]).join(', ')}\n\n${mdEscape(n.summary)}\n\n${mdEscape(n.content)}\n\n**Další krok:** ${mdEscape(n.next)}`)].join('\n');}
    function tasksMarkdown(){return ['# Úkoly LifeHub',...state.tasks.map(t=>`\n- [${t.done?'x':' '}] **${t.title}** (${taskPriorityLabel(t.priority)}${t.due?', '+t.due:''}) — ${t.area||''}\n  ${t.note||''}`)].join('\n');}
    function shoppingMarkdown(){return ['# Nákupy LifeHub',...state.shopping.map(s=>`\n- **${s.name}** — ${shopPriorityLabel(s.priority)}, ${fmt(s.price)}, ${s.month||'bez měsíce'}, ${shopStatusLabel(s.status)}\n  ${s.note||''}${s.url?'\n  '+s.url:''}`)].join('\n');}
    function buildMarkdown(notion=false){
      const lines=[]; lines.push(`# LifeHub export ${today()}`,'',`Vlastník: ${state.settings.ownerName || ''}`,'');
      lines.push(notesMarkdown(),'', '# Finance');
      state.transactions.forEach(t=>lines.push(`- ${t.date} | ${t.kind==='income'?'Příjem':'Výdaj'} | ${t.category} | ${fmt(t.amount)} | ${t.description||''}`));
      lines.push('', '# Výplatní pásky'); state.payrolls.forEach(p=>lines.push(`- ${p.month} | ${p.employer||''} | čistá ${fmt(p.fields?.netPay||0)} | hrubá ${fmt(p.fields?.grossPay||0)} | daň ${fmt(p.fields?.incomeTax||0)} | ${p.note||''}`));
      lines.push('', '# Šifrovaný trezor dokumentů'); state.documents.forEach(d=>lines.push(`- ${d.date||''} | ${d.title||''} | ${docCategoryLabel(d.category)} | ${d.fileName||''} | ${formatBytes(d.size)}`));
      lines.push('', tasksMarkdown(), '', shoppingMarkdown());
      if(notion) lines.push('', '---', 'Import do Notion: dlouhé texty vložte jako Markdown stránku; tabulky použijte přes CSV exporty.');
      return lines.join('\n');
    }

    function sumByMonth(){
      const map={};
      state.transactions.forEach(t=>{const m=(t.date||'').slice(0,7)||t.payrollMonth||'bez-mesice'; map[m]??={month:m,income:0,expense:0,balance:0,count:0}; const a=number(t.amount); if(t.kind==='income') map[m].income+=a; else map[m].expense+=a; map[m].balance=map[m].income-map[m].expense; map[m].count++;});
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
        const period = quarterOf((t.date||'').slice(0,7)||t.payrollMonth);
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
    function sanitizePayrollFields(fields){ const out={}; payFieldDefs.forEach(([key])=>out[key]=number(fields[key])); return out; }
    function classifyPayrollNote(note){ const n=strip(note||''); if(!n) return ''; const labels=[]; if(n.includes('odmen')||n.includes('premi')||n.includes('bonus')) labels.push('odmeny'); if(n.includes('nemoc')) labels.push('nemoc'); if(n.includes('dovol')) labels.push('dovolena'); if(n.includes('prescas')||n.includes('priplat')) labels.push('prescas/priplatky'); return labels.join(', ') || 'poznamka anonymizovana'; }
    function buildAnonymizedMarkdown(){
      const snap=buildAnonymizedSnapshot(); const lines=[];
      lines.push(`# LifeHub anonymizovaný export ${today()}`,'',snap.privacy,'');
      lines.push('## Počty položek',`- Poznámky: ${snap.counts.notes}`,`- Transakce: ${snap.counts.transactions}`,`- Výplatní pásky: ${snap.counts.payrolls}`,`- Dokumenty v lokálním archivu: ${snap.counts.documents}`,`- Úkoly: ${snap.counts.tasks}`,`- Nákupy: ${snap.counts.shopping}`,'');
      lines.push('## Finance po kvartálech'); snap.quarterlyFinance.forEach(m=>lines.push(`- ${m.period}: příjmy ${m.incomeRange}, výdaje ${m.expenseRange}, bilance ${m.balanceSign} ${m.balanceRange}, položek ${m.count}`));
      lines.push('', '## Výplatní pásky bez identifikátorů'); snap.payrolls.forEach(p=>lines.push(`- ${p.period}: čistá ${p.fields.netPay}, hrubá ${p.fields.grossPay}, daň ${p.fields.incomeTax}, sleva poplatník ${p.fields.taxpayerDiscount}, soc. ${p.fields.socialInsurance}, zdr. ${p.fields.healthInsurance}, srážky ${p.fields.deductions}, pozn.: ${p.noteCategory||'—'}`));
      lines.push('', '## Nákupy souhrnně'); snap.shoppingSummary.forEach(s=>lines.push(`- ${s.period||'bez období'} | ${shopPriorityLabel(s.priority)} | ${shopStatusLabel(s.status)} | ${s.count} položek | ${s.totalRange}`));
      lines.push('', '## Úkoly souhrnně'); snap.taskSummary.forEach(t=>lines.push(`- ${taskPriorityLabel(t.priority)} | ${t.status==='done'?'hotové':'otevřené'} | ${t.count}`));
      lines.push('', '## Dokumenty v archivu souhrnně'); snap.documentSummary.forEach(d=>lines.push(`- ${d.label}: ${d.count} souborů, celkem ${formatBytes(d.totalSize)}`));
      return lines.join('\n');
    }
    function exportAnonymizedPayrollsCsv(){
      const rows=[['record','period','netPayRange','grossPayRange','taxBaseRange','incomeTaxRange','taxpayerDiscountRange','childDiscountRange','socialInsuranceRange','healthInsuranceRange','deductionsRange','mealVouchersRange','bonusRange','sickPayRange','vacationPayRange','overtimeRange','workedHoursRange','employerCostRange','noteCategory']];
      buildAnonymizedSnapshot().payrolls.forEach(p=>rows.push([p.record,p.period,p.fields.netPay,p.fields.grossPay,p.fields.taxBase,p.fields.incomeTax,p.fields.taxpayerDiscount,p.fields.childDiscount,p.fields.socialInsurance,p.fields.healthInsurance,p.fields.deductions,p.fields.mealVouchers,p.fields.bonus,p.fields.sickPay,p.fields.vacationPay,p.fields.overtime,p.fields.workedHours,p.fields.employerCost,p.noteCategory]));
      download(`lifehub-anonymizovane-pasky-${today()}.csv`, csv(rows), 'text/csv;charset=utf-8');
    }

    async function importJson(e){
      const file=e.target.files[0]; if(!file)return;
      try{
        let data=JSON.parse(await file.text());
        if(data?.kind === 'LifeHub encrypted backup'){
          const pass = await passwordDialog({title:'Obnovit šifrovanou zálohu', message:'Tato záloha je šifrovaná. Zadejte heslo pro obnovení.', minLength:1, confirmText:'Odemknout zálohu'});
          if(!pass) return;
          data = await decryptBackupObject(data, pass);
        }
        const imported = sanitizeImportedState(data);
        const summary = `Import přepíše současná lokální data.\n\nNová záloha obsahuje:\n- ${imported.notes.length} poznámek\n- ${imported.transactions.length} transakcí\n- ${imported.payrolls.length} výplatních pásek\n- ${imported.documents.length} dokumentů v indexu archivu\n- ${imported.tasks.length} úkolů\n- ${imported.shopping.length} nákupů\n\nOriginální soubory v IndexedDB se tímto JSON importem nepřenesou. Pokračovat?`;
        if(!await confirmDialog(summary, {title:'Import JSON zálohy', confirmText:'Importovat', danger:true})) return;
        state=imported; setTheme(state.settings.theme||'dark'); save(); hydrateSettings(); toast('Záloha importována po bezpečnostní kontrole.');
      }
      catch(err){ console.error(err); toast('Soubor se nepodařilo importovat: '+(err.message||err),'bad'); }
      finally{e.target.value='';}
    }
    function hydrateSettings(){ $('#ownerName').value=state.settings.ownerName||''; $('#ownerFooter').value=state.settings.ownerFooter||''; $('#currency').value=state.settings.currency||'Kč'; $('#savingGoal').value=state.settings.savingGoal||0; }
    function saveSettings(e){e.preventDefault(); state.settings.ownerName=$('#ownerName').value.trim(); state.settings.ownerFooter=$('#ownerFooter').value.trim(); state.settings.currency=sanitizeCurrency($('#currency').value); state.settings.savingGoal=number($('#savingGoal').value); save(); toast('Nastavení uloženo.');}
    function renderFooter(){ $('#footer').innerHTML=`<strong>${esc(state.settings.ownerName||'Vlastník aplikace: Daniel Baláž · Gymnázium, Ostrava-Hrabůvka')}</strong><br><span>${esc(state.settings.ownerFooter||'© 2026 Daniel Baláž. Všechna práva vyhrazena.')}</span>`;}
    async function runDiagnostics(){
      const rows=[]; const ok=(name,detail,good=true)=>rows.push(`<div class="item"><h4>${good?'✅':'⚠️'} ${esc(name)}</h4><p>${esc(detail)}</p></div>`);
      try{localStorage.setItem('lifehub.test','ok'); localStorage.removeItem('lifehub.test'); ok('localStorage','Zápis a čtení lokálních dat funguje.');}catch(e){ok('localStorage','Lokální ukládání nefunguje: '+e.message,false);}
      try{await openDb(); ok('IndexedDB','Úložiště pro PDF a šifrovaný trezor funguje.');}catch(e){ok('IndexedDB','PDF úložiště není dostupné: '+e.message,false);}
      ok('PDF.js', pdfjsLibRef ? 'Knihovna PDF.js je načtená z lokální vendor kopie.' : 'PDF.js je v režimu lazy-load; načte se z lokální složky vendor až při importu PDF. To je očekávané chování.', true);
      ok('Content Security Policy', document.querySelector('meta[http-equiv="Content-Security-Policy"]')?'Základní CSP je nastavena.':'CSP meta tag chybí.', !!document.querySelector('meta[http-equiv="Content-Security-Policy"]'));
      ok('Externí skripty', pdfJsSource==='cdn'?'PDF.js byl načten z CDN, což je chyba konfigurace.':'Při startu se nenačítá žádný externí CDN skript; PDF.js je lokální lazy-load.', pdfJsSource!=='cdn');
      ok('Šifrované úložiště', vaultKey && appReady ? 'Aplikace je odemčená a šifrované ukládání je aktivní.' : 'Aplikace není v odemčeném režimu.', !!vaultKey && appReady);
      ok('Web Crypto API', window.crypto?.subtle?'Web Crypto API je dostupné pro šifrování stavu, souborů i záloh.':'Web Crypto API není dostupné; LifeHub 3.0 nebude fungovat bezpečně.', !!window.crypto?.subtle);
      ok('Dialogy aplikace','Potvrzení a hesla používají vlastní modální dialogy místo nativních prompt/confirm, takže jsou použitelné i testovatelné na mobilu.', true);
      const bytes=new Blob([JSON.stringify(state)]).size; ok('Velikost JSON dat', `${(bytes/1024).toFixed(1)} kB v localStorage.`);
      ok('Počty položek', `${state.notes.length} poznámek, ${state.transactions.length} transakcí, ${state.payrolls.length} pásek, ${state.documents.length} dokumentů, ${state.tasks.length} úkolů, ${state.shopping.length} nákupů.`);
      ok('Citlivý obsah', `${state.payrolls.filter(p=>p.rawText).length} uložených raw textů z PDF, ${state.payrolls.filter(p=>p.storedPdf).length} uložených PDF pásek, ${state.documents.length} dokumentů v archivu. V LifeHub 3.0 se ukládají šifrovaně po odemčení.`, true);
      $('#diagnostics').innerHTML=rows.join('');
    }
    async function seedDemo(){
      if(!await confirmDialog('Vložit ukázková data? Přidají se k současným datům.', {title:'Ukázková data', confirmText:'Vložit'})) return;
      state.notes.unshift({id:uid('note'),title:'Ukázka: dobrý prompt z AI vlákna',source:'ChatGPT',priority:4,type:'prompt',model:'GPT',url:'',tags:['ai','výuka'],summary:'Sem patří krátká pointa užitečného vlákna.',content:'Uložte jen to, co budete později opravdu hledat.',next:'Převést do pracovního listu.',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
      const m=monthNow(); state.transactions.unshift({id:uid('trans'),date:`${m}-01`,kind:'income',category:'mzda',amount:42000,description:'Ukázkový příjem',source:'manual',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()},{id:uid('trans'),date:`${m}-05`,kind:'expense',category:'bydlení',amount:14500,description:'Ukázkový výdaj',source:'manual',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
      state.tasks.unshift({id:uid('task'),title:'Zpracovat poznámky z AI vláken',priority:'urgent',due:today(),area:'AI',note:'Ukázkový úkol',done:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
      state.shopping.unshift({id:uid('shop'),name:'Ukázkový nákup',priority:'soon',status:'planned',category:'technika',price:6000,month:m,url:'',note:'Ukázka pro graf',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
      save(); toast('Ukázková data vložena.');
    }
    async function clearAllData(){
      if(!await confirmDialog('Opravdu smazat všechna lokální data aplikace včetně šifrovaného stavu, PDF a dokumentů v IndexedDB?', {title:'Smazat všechna lokální data', confirmText:'Smazat vše', danger:true}))return;
      state=defaultState();
      try{ localStorage.removeItem(ENC_STORE); localStorage.removeItem(LEGACY_STORE); }catch(e){ console.warn(e); }
      try{ await idbClear(PDF_STORE); await idbClear(VAULT_STORE); }catch(e){ console.warn(e); toast('Metadata byla smazána, ale vyčištění IndexedDB se nemuselo podařit.', 'warn'); }
      vaultKey=null; vaultSalt=null; appReady=false;
      hydrateSettings(); setTheme(state.settings.theme); renderAll(); toast('Lokální data byla smazána včetně šifrovaného úložiště.','warn');
      await startSecureGate();
    }
    function empty(text){return `<div class="empty">${esc(text)}</div>`;}
    function registerSW(){ registerServiceWorker('./sw.js'); }
    init();
}
