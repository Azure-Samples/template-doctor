/* Legacy batch scan UI extraction (phase 2 COMPLETE)
   Full migration of legacy batch scan (IndexedDB + per-item UI + resume / retry / cancel) out of app.js.
   This module preserves original behavior while isolating code for future convergence with the
   server-driven batch scanning implementation in batch-scan.ts.

   Public window API (backwards compat / tests):
     window.LegacyBatchScan.start()
     window.LegacyBatchScan.cancel()
     window.LegacyBatchScan.db   (debug reference)
     window.LegacyBatchScan.store (progress helpers)
*/
// Ensure module scope so top-level symbols (e.g., `state`) don't collide with other script files (tooltips.ts etc.)
export {};

interface LegacyBatchProgressEntry { id: string; url: string; status: string; timestamp: string; result?: any }

const DB_NAME = 'BatchScanDB';
const STORE = 'batchProgress';
let db: IDBDatabase | null = null;

function debug(...a:any[]){ console.debug('[batch-scan-legacy]', ...a); }
function notify(){ return (window as any).NotificationSystem || (window as any).Notifications; }

// --- IndexedDB Helpers ----------------------------------------------------
async function openDB(): Promise<IDBDatabase>{
  if(db) return db;
  db = await new Promise<IDBDatabase>((resolve,reject)=>{
    const req = indexedDB.open(DB_NAME,1);
    req.onerror = ()=>reject(new Error('open error'));
    req.onupgradeneeded = e=>{
      const d = (e.target as any).result as IDBDatabase;
      if(!d.objectStoreNames.contains(STORE)){
        const store = d.createObjectStore(STORE,{ keyPath:'id' });
        store.createIndex('url','url',{ unique:true });
        store.createIndex('status','status',{ unique:false });
      }
    };
    req.onsuccess = e=> resolve((e.target as any).result as IDBDatabase);
  });
  return db;
}

async function putProgress(entry: LegacyBatchProgressEntry){
  const d = await openDB();
  await new Promise<void>((res,rej)=>{
    const tx = d.transaction([STORE],'readwrite');
    const store = tx.objectStore(STORE); store.put(entry); tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error||new Error('put error'));
  });
}
async function getAllProgress(): Promise<LegacyBatchProgressEntry[]>{
  const d = await openDB();
  return await new Promise((res,rej)=>{
    const tx = d.transaction([STORE],'readonly');
    const store = tx.objectStore(STORE); const r = store.getAll(); r.onsuccess=()=>res(r.result as any); r.onerror=()=>rej(r.error||new Error('getAll error'));
  });
}
async function clearProgress(){
  const d = await openDB();
  await new Promise<void>((res,rej)=>{
    const tx = d.transaction([STORE],'readwrite');
    const store = tx.objectStore(STORE); const r = store.clear(); r.onsuccess=()=>res(); r.onerror=()=>rej(r.error||new Error('clear error'));
  });
}

// --- UI + Logic -----------------------------------------------------------
let state = {
  urls: [] as string[],
  active: false,
  processed: 0,
  cancelled: false,
  resumeMode: false,
};

// DOM cache (filled on wire)
let el = {
  textarea: null as HTMLTextAreaElement | null,
  results: null as HTMLElement | null,
  items: null as HTMLElement | null,
  progressBar: null as HTMLElement | null,
  progressText: null as HTMLElement | null,
  cancelBtn: null as HTMLButtonElement | null,
  cancelContainer: null as HTMLElement | null,
  batchResults: null as HTMLElement | null,
};

function parseUrls(textarea: HTMLTextAreaElement | null): string[]{
  if(!textarea) return [];
  const raw = textarea.value.trim();
  if(!raw) return [];
  let urls = raw.split(/[\n,]+/).map(u=>u.trim()).filter(Boolean).map(url=>{
    if(!url.startsWith('http')){
      if(url.includes('/')) return `https://github.com/${url}`; else return '';
    }
    return url;
  }).filter(Boolean);
  return urls;
}

async function start(){
  if(state.active){ debug('Batch already active'); return; }
  // Acquire fresh DOM refs (in case of dynamic reloads)
  wireDom();
  const urls = parseUrls(el.textarea);
  if(urls.length===0){ notify()?.showWarning?.('No URLs Found','Please enter at least one valid GitHub repository URL.',5000); return; }

  try {
    await openDB();
    const existing = await getAllProgress();
    state.resumeMode = false;
    if(existing.length){
      const existingUrls = existing.map(p=>p.url);
      const matching = urls.filter(u=> existingUrls.includes(u));
      if(matching.length){
        // Ask user about resuming
        await new Promise<void>(resolve=>{
          notify()?.confirm ? notify().confirm('Resume Batch Scan',`Found ${matching.length} previously scanned repositories. Resume and skip successful scans?`,{confirmLabel:'Resume',cancelLabel:'Start Fresh',onConfirm:()=>{state.resumeMode=true; resolve();},onCancel:()=>{clearProgress().finally(()=>resolve());}})
          : (confirm(`Found ${matching.length} previously scanned repositories. Resume?`) ? (state.resumeMode=true, resolve()) : clearProgress().finally(()=>resolve()));
        });
      } else {
        await clearProgress();
      }
    }

    // Reset state
    state.urls = urls; state.active = true; state.processed = 0; state.cancelled=false;
    if(el.items) el.items.innerHTML='';
    if(el.progressBar) el.progressBar.style.width='0%';
    if(el.progressText) el.progressText.textContent = `0/${urls.length} Completed`;
    el.batchResults?.classList.add('active');
    if(el.cancelContainer) el.cancelContainer.style.display='block';

    let existingMap: Record<string, LegacyBatchProgressEntry> = {};
    if(state.resumeMode){
      const existingProgress = await getAllProgress();
      existingMap = Object.fromEntries(existingProgress.map(p=>[p.url,p]));
    }

    urls.forEach((url,idx)=>{
      const item = document.createElement('div');
      let cls='batch-item pending', status='Pending', message='Waiting to be processed...';
      let viewDisabled = true, retryDisabled = true;
      const existingEntry = existingMap[url];
      if(state.resumeMode && existingEntry?.status==='success'){
        cls='batch-item success'; status='Completed';
        const issues = existingEntry.result?.compliance?.issues?.length ?? '?';
        const passed = existingEntry.result?.compliance?.compliant?.length ?? '?';
        message = `Analysis complete: ${issues} issues, ${passed} passed`;
        viewDisabled = false; state.processed++;
      }
      item.className = cls; item.id = `batch-item-${idx}`;
      const repoName = url.includes('github.com/') ? url.split('github.com/')[1] : url;
      item.innerHTML = `
        <div class="batch-item-header">
          <div class="batch-item-title">${repoName}</div>
          <div class="batch-item-status">${status}</div>
        </div>
        <div class="batch-item-message">${message}</div>
        <div class="batch-item-actions">
          <button class="view-btn" ${viewDisabled?'disabled':''}>View Report</button>
          <button class="retry-btn" ${retryDisabled?'disabled':''}>Retry</button>
        </div>`;
      el.items?.appendChild(item);
      if(state.resumeMode && !viewDisabled && existingEntry?.result){
        item.querySelector('.view-btn')?.addEventListener('click',()=> display(existingEntry.result));
      }
    });

    if(state.resumeMode && state.processed){
      const pct = (state.processed/urls.length)*100; if(el.progressBar) el.progressBar.style.width = pct+'%'; if(el.progressText) el.progressText.textContent = `${state.processed}/${urls.length} Completed`;
    }

    for(let i=0;i<urls.length;i++){
      if(state.cancelled) break;
      await processOne(urls[i], i);
    }

    finalize();
  } catch(err:any){
    debug('Batch scan error', err);
    notify()?.showError?.('Batch Scan Error', `An error occurred during batch scan: ${err.message||err}`, 8000);
  }
}

async function processOne(url:string, index:number){
  const item = document.getElementById(`batch-item-${index}`);
  if(!item) return;
  if(item.classList.contains('success')) return; // resume skip
  item.className='batch-item processing';
  item.querySelector('.batch-item-status')!.textContent='Processing';
  item.querySelector('.batch-item-message')!.textContent='Analyzing...';
  let processedUrl = url;
  try {
    if((window as any).checkAndUpdateRepoUrl){ processedUrl = await (window as any).checkAndUpdateRepoUrl(url); }
  } catch(e:any){ debug('Fork substitution skipped', e?.message||e); }
  try {
    const analyzer = (window as any).TemplateAnalyzer;
    if(!analyzer){ throw new Error('Analyzer unavailable'); }
    const result = await analyzer.analyzeTemplate(processedUrl, 'dod');
    item.className='batch-item success';
    item.querySelector('.batch-item-status')!.textContent='Completed';
    item.querySelector('.batch-item-message')!.textContent = `Analysis complete: ${result.compliance.issues.length} issues, ${result.compliance.compliant.length} passed`;
    const viewBtn = item.querySelector('.view-btn') as HTMLButtonElement | null;
    const retryBtn = item.querySelector('.retry-btn') as HTMLButtonElement | null;
    if(viewBtn){ viewBtn.disabled=false; viewBtn.addEventListener('click',()=>display(result)); }
    if(retryBtn){ retryBtn.disabled=true; }
    await putProgress({ id:`repo-${index}`, url, status:'success', timestamp:new Date().toISOString(), result });
  } catch(err:any){
    item.className='batch-item error';
    item.querySelector('.batch-item-status')!.textContent='Error';
    item.querySelector('.batch-item-message')!.textContent= err.message || 'Analysis failed';
    const retryBtn = item.querySelector('.retry-btn') as HTMLButtonElement | null;
    if(retryBtn){
      retryBtn.disabled=false;
      retryBtn.addEventListener('click', async ()=>{
        retryBtn.disabled=true; item.className='batch-item processing'; item.querySelector('.batch-item-status')!.textContent='Processing'; item.querySelector('.batch-item-message')!.textContent='Retrying...';
        try {
          const analyzer = (window as any).TemplateAnalyzer; if(!analyzer) throw new Error('Analyzer unavailable');
          const retryResult = await analyzer.analyzeTemplate(processedUrl,'dod');
          item.className='batch-item success'; item.querySelector('.batch-item-status')!.textContent='Completed'; item.querySelector('.batch-item-message')!.textContent = `Analysis complete: ${retryResult.compliance.issues.length} issues, ${retryResult.compliance.compliant.length} passed`;
          const viewBtn = item.querySelector('.view-btn') as HTMLButtonElement | null; if(viewBtn){ viewBtn.disabled=false; viewBtn.addEventListener('click',()=>display(retryResult)); }
          await putProgress({ id:`repo-${index}`, url, status:'success', timestamp:new Date().toISOString(), result: retryResult });
        } catch(retryErr:any){
          item.className='batch-item error'; item.querySelector('.batch-item-status')!.textContent='Error'; item.querySelector('.batch-item-message')!.textContent = retryErr.message || 'Retry failed'; retryBtn.disabled=false; await putProgress({ id:`repo-${index}`, url, status:'error', timestamp:new Date().toISOString() });
        }
      });
    }
    await putProgress({ id:`repo-${index}`, url, status:'error', timestamp:new Date().toISOString() });
  }
  state.processed++;
  const pct = (state.processed/state.urls.length)*100;
  if(el.progressBar) el.progressBar.style.width = pct+'%';
  if(el.progressText) el.progressText.textContent = `${state.processed}/${state.urls.length} Completed`;
}

function display(result:any){
  const analysisSection = document.getElementById('analysis-section');
  const resultsContainer = document.getElementById('results-container');
  const loadingContainer = document.getElementById('loading-container');
  const errorSection = document.getElementById('error-section');
  if(!analysisSection || !resultsContainer) return;
  document.getElementById('search-section')!.style.display='none';
  analysisSection.style.display='block';
  resultsContainer.style.display='block';
  loadingContainer && (loadingContainer.style.display='none');
  errorSection && (errorSection.style.display='none');
  const repoName = (result.repoUrl?.split('github.com/')[1]) || result.repoUrl || 'Repository';
  const rnEl = document.getElementById('repo-name'); if(rnEl) rnEl.textContent = repoName;
  const ruEl = document.getElementById('repo-url'); if(ruEl) ruEl.textContent = result.repoUrl;
  try {
    const dash = (window as any).DashboardRenderer; if(dash) dash.render(result, resultsContainer); else resultsContainer.textContent = 'Dashboard renderer unavailable';
    analysisSection.scrollIntoView({ behavior:'smooth' });
  } catch(e:any){ resultsContainer.textContent = 'Render error: '+ (e.message||e); }
}

function finalize(){
  if(el.cancelContainer) el.cancelContainer.style.display='none';
  if(state.cancelled){
    const cancelled = state.urls.length - state.processed;
    notify()?.showInfo?.('Batch Scan Cancelled', `Batch scan cancelled. ${state.processed} repositories processed, ${cancelled} cancelled.`, 6000);
  } else {
    notify()?.showSuccess?.('Batch Scan Complete', `Completed scanning ${state.urls.length} repositories.`, 6000);
  }
  state.active=false;
}

function cancel(){
  if(!state.active) return;
  state.cancelled = true;
  if(el.cancelBtn){ el.cancelBtn.disabled=true; el.cancelBtn.textContent='Cancelling...'; }
  putProgress({ id:'batch-status', url:'cancel', status:'cancelled', timestamp:new Date().toISOString(), result:{ processedCount: state.processed, totalCount: state.urls.length }}).catch(()=>{});
  notify()?.showInfo?.('Cancelling Batch Scan','Current repository will finish before stopping.',5000);
}

function wireDom(){
  el.textarea = document.getElementById('batch-urls') as HTMLTextAreaElement | null;
  el.results = document.getElementById('batch-results');
  el.items = document.getElementById('batch-items');
  el.progressBar = document.getElementById('batch-progress-bar');
  el.progressText = document.getElementById('batch-progress-text');
  el.cancelBtn = document.getElementById('batch-cancel-btn') as HTMLButtonElement | null;
  el.cancelContainer = document.getElementById('batch-cancel-container');
  el.batchResults = document.getElementById('batch-results');
}

function wire(){
  wireDom();
  const startBtn = document.getElementById('batch-scan-button');
  if(startBtn && !startBtn.getAttribute('data-batch-scan-extracted')){
    startBtn.setAttribute('data-batch-scan-extracted','1');
    startBtn.addEventListener('click', ()=> start());
    debug('Legacy batch scan logic fully extracted and wired');
  }
  if(el.cancelBtn && !el.cancelBtn.getAttribute('data-batch-scan-extracted')){
    el.cancelBtn.setAttribute('data-batch-scan-extracted','1');
    el.cancelBtn.addEventListener('click', ()=> cancel());
  }
}

if(typeof document !== 'undefined'){
  (document.readyState === 'loading') ? document.addEventListener('DOMContentLoaded', wire) : wire();
}

// Exposed API
(window as any).LegacyBatchScanStore = { putProgress, getAllProgress, clearProgress };
(window as any).LegacyBatchScan = { start, cancel, db: ()=>db, store: (window as any).LegacyBatchScanStore };
