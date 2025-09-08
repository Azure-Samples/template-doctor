/* Batch scan extraction using backend endpoints */
import { ApiClient } from './api-client';

interface BatchStartResponse { batchId: string }
interface BatchStatusResponse { batchId: string; status: string; startedAt: string; updatedAt: string; completedAt?: string; total?: number; processed?: number; results?: any[] }

const POLL_INTERVAL = 1500;

function notify(){ return (window as any).NotificationSystem || (window as any).Notifications; }
function showInfo(t:string,m:string){ const n=notify(); if(n?.showInfo) n.showInfo(t,m,4000); else console.log(t+': '+m);} 
function showError(t:string,m:string){ const n=notify(); if(n?.showError) n.showError(t,m,8000); else console.error(t+': '+m);} 

let currentBatch: string | null = null;
let pollHandle: number | null = null;

const batchButtonId = 'batch-scan-button';
const progressBarId = 'batch-progress-bar';
const progressTextId = 'batch-progress-text';
const batchItemsId = 'batch-items';
const batchCancelId = 'batch-cancel-btn';

function $(id:string){ return document.getElementById(id); }

function wireUI(){
  const btn = $(batchButtonId);
  if(btn && !btn.getAttribute('data-wired')){
    btn.setAttribute('data-wired','1');
    btn.addEventListener('click', () => {
      const ta = document.getElementById('batch-urls') as HTMLTextAreaElement | null;
      if(!ta) return;
      const repos = ta.value.split(/\n|,/).map(s=>s.trim()).filter(Boolean);
      if(!repos.length){ showError('Batch Scan','Enter at least one repository URL'); return; }
      startBatch(repos);
    });
  }
  document.addEventListener('batch-status', (e:any)=>{
    const detail = e.detail;
    const bar = $(progressBarId);
    const txt = $(progressTextId);
    if(bar && detail.total){
      const pct = detail.total ? Math.min(100, Math.round((detail.processed||0)/detail.total*100)) : 0;
      (bar as HTMLElement).style.width = pct+'%';
    }
    if(txt && detail.total){
      txt.textContent = `${detail.processed||0}/${detail.total} Completed`;
    }
    if(detail.results && Array.isArray(detail.results)){
      const container = $(batchItemsId);
      if(container){
        container.innerHTML = '';
        detail.results.forEach((r:any)=>{
          const div = document.createElement('div');
            div.className = 'batch-item';
            div.textContent = r.repo || r.repository || JSON.stringify(r);
            container.appendChild(div);
        });
      }
    }
  });
  document.addEventListener('batch-started', ()=>{
    const cancel = $(batchCancelId);
    if(cancel){ cancel.parentElement && (cancel.parentElement.style.display='block'); cancel.onclick = () => cancelBatch(); }
  });
  document.addEventListener('batch-finished', ()=>{
    const cancel = $(batchCancelId);
    if(cancel){ cancel.parentElement && (cancel.parentElement.style.display='none'); }
  });
  document.addEventListener('batch-cancelled', ()=>{
    const cancel = $(batchCancelId) as HTMLButtonElement | null;
    if(cancel){
      cancel.disabled = true;
      cancel.textContent = 'Cancelled';
      setTimeout(()=>{ if(cancel.parentElement) cancel.parentElement.style.display='none'; }, 1200);
    }
    showInfo('Batch Scan Cancelled','Processing stopped');
  });
}

if(typeof document !== 'undefined'){
  if(document.readyState === 'complete' || document.readyState === 'interactive'){
    wireUI();
  } else {
    document.addEventListener('DOMContentLoaded', wireUI);
  }
}

export async function startBatch(repos: string[]){
  try {
    const res = await fetch('/api/batch-scan/start', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ repos })});
    if(!res.ok) throw new Error('Failed to start batch');
    const data: BatchStartResponse = await res.json();
    currentBatch = data.batchId;
    document.dispatchEvent(new CustomEvent('batch-started',{ detail: data }));
    showInfo('Batch Started', data.batchId);
    beginPolling();
  } catch(e:any){ showError('Batch Start Failed', e.message||String(e)); }
}

async function poll(){
  if(!currentBatch) return;
  try {
    const r = await fetch(`/api/batch-scan/status?batchId=${encodeURIComponent(currentBatch)}`);
    if(!r.ok) throw new Error('Status failed');
    const data: BatchStatusResponse = await r.json();
    document.dispatchEvent(new CustomEvent('batch-status',{ detail: data }));
    if(data.status === 'completed' || data.status === 'failed'){
      clearPolling();
      document.dispatchEvent(new CustomEvent('batch-finished',{ detail: data }));
      showInfo('Batch Finished', data.status);
    }
  } catch(e:any){ showError('Batch Poll Error', e.message||String(e)); }
}

function beginPolling(){ clearPolling(); poll(); pollHandle = window.setInterval(poll, POLL_INTERVAL); }
function clearPolling(){ if(pollHandle){ clearInterval(pollHandle); pollHandle=null; } }

export function cancelBatch(){
  clearPolling();
  currentBatch = null;
  document.dispatchEvent(new CustomEvent('batch-cancelled'));
}

// Expose globally for legacy bridging
(window as any).TemplateDoctorBatchScan = { startBatch, cancelBatch };
