/* Tooltips module (migrated from js/tooltips.js)
   Provides custom tooltip behavior replacing title & data-tooltip attributes.
*/

interface TooltipGlobals {
  tooltipEl: HTMLDivElement | null;
  mouseX: number;
  mouseY: number;
}

const state: TooltipGlobals = { tooltipEl: null, mouseX: 0, mouseY: 0 };

function ensureTooltipEl(){
  if(state.tooltipEl) return state.tooltipEl;
  const el = document.createElement('div');
  el.className = 'tooltip';
  document.body.appendChild(el);
  state.tooltipEl = el;
  return el;
}

function positionTooltip(x:number,y:number){
  const tooltip = state.tooltipEl; if(!tooltip) return;
  const rect = tooltip.getBoundingClientRect();
  let tx = x + 15; let ty = y + 15;
  const ww = window.innerWidth; const wh = window.innerHeight;
  if(tx + rect.width > ww) tx = ww - rect.width - 10;
  if(ty + rect.height > wh) ty = y - rect.height - 10;
  tooltip.style.left = tx + 'px';
  tooltip.style.top = ty + 'px';
}

function showFor(text: string){
  const tooltip = ensureTooltipEl();
  tooltip.textContent = text;
  tooltip.classList.add('visible');
  positionTooltip(state.mouseX, state.mouseY);
}

function hideTooltip(){
  if(state.tooltipEl){ state.tooltipEl.classList.remove('visible'); }
}

function onMouseMove(e: MouseEvent){
  state.mouseX = e.clientX; state.mouseY = e.clientY;
  if(state.tooltipEl?.classList.contains('visible')){
    positionTooltip(state.mouseX, state.mouseY);
  }
}

function onMouseOver(e: Event){
  const target = e.target as HTMLElement | null; if(!target) return;
  if(target.hasAttribute('title')){
    const raw = target.getAttribute('title') || '';
    if(raw.trim() !== ''){
      target.dataset.tooltip = raw;
      target.removeAttribute('title');
      showFor(raw);
    }
  } else if(target.dataset.tooltip && target.dataset.tooltip.trim() !== ''){
    showFor(target.dataset.tooltip);
  }
}

function onMouseOut(e: Event){
  const target = e.target as HTMLElement | null; if(!target) return;
  if(target.dataset.tooltip){
    hideTooltip();
    if(!target.classList.contains('has-permanent-tooltip')){
      // restore original title for accessibility fallback
      target.setAttribute('title', target.dataset.tooltip);
      delete target.dataset.tooltip;
    }
  }
}

function init(){
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseover', onMouseOver);
  document.addEventListener('mouseout', onMouseOut);
}

if(typeof document !== 'undefined'){
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
}

// Expose for any legacy bridging / debugging (optional)
;(window as any).TemplateDoctorTooltips = { forceShow: showFor, forceHide: hideTooltip };
