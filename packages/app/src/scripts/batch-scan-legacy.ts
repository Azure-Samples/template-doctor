/* Legacy batch scan UI extraction (phase 1)
   Hosts IndexedDB persistence & per-item card rendering that previously lived in app.js.
   Goal: progressively refactor toward backend-driven batch scanning (batch-scan.ts) or merge features.
*/

interface LegacyBatchProgressEntry { id: string; url: string; status: string; timestamp: string; result?: any }

const DB_NAME = 'BatchScanDB';
const STORE = 'batchProgress';
let db: IDBDatabase | null = null;

function debug(...a:any[]){ console.debug('[batch-scan-legacy]', ...a); }

function notify(){ return (window as any).NotificationSystem || (window as any).Notifications; }

async function openDB(): Promise<IDBDatabase>{
  if(db) return db;
  db = await new Promise<IDBDatabase>((resolve,reject)=>{
    const req = indexedDB.open(DB_NAME,1);
    req.onerror = e=>reject(new Error('open error'));
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
    tx.onabort = ()=>rej(tx.error||new Error('tx abort'));
    const store = tx.objectStore(STORE);
    store.put(entry);
    tx.oncomplete = ()=>res();
  });
}

async function getAllProgress(): Promise<LegacyBatchProgressEntry[]>{
  const d = await openDB();
  return await new Promise((res,rej)=>{
    const tx = d.transaction([STORE],'readonly');
    const store = tx.objectStore(STORE);
    const r = store.getAll();
    r.onerror = ()=>rej(r.error||new Error('getAll error'));
    r.onsuccess = ()=>res(r.result as any);
  });
}

async function clearProgress(){
  const d = await openDB();
  await new Promise<void>((res,rej)=>{
    const tx = d.transaction([STORE],'readwrite');
    const store = tx.objectStore(STORE);
    const r = store.clear();
    r.onerror = ()=>rej(r.error||new Error('clear error'));
    r.onsuccess = ()=>res();
  });
}

// Minimal DOM bindings (phase 1) – non-invasive so app.js can still operate while we verify parity.
function wire(){
  const btn = document.getElementById('batch-scan-button');
  if(btn && !btn.getAttribute('data-legacy-extracted')){
    btn.setAttribute('data-legacy-extracted','1');
    debug('Legacy batch scan extraction scaffold active');
  }
}

if(typeof document !== 'undefined'){
  if(document.readyState === 'loading'){ document.addEventListener('DOMContentLoaded', wire); }
  else { wire(); }
}

// Expose a small API for incremental migration & tests
(window as any).LegacyBatchScanStore = { putProgress, getAllProgress, clearProgress };
