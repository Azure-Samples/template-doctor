// Extracted modal component logic placeholder (to be wired with existing ruleset-modal logic during full migration)
export interface ModalOptions {
  id?: string;
  title: string;
  content: string | HTMLElement;
  onClose?: () => void;
}

export function createModal(opts: ModalOptions): HTMLElement {
  const { id = 'modal-' + Date.now(), title, content, onClose } = opts;
  const wrapper = document.createElement('div');
  wrapper.className = 'td-modal';
  wrapper.id = id;
  wrapper.innerHTML = `
    <div class="td-modal-backdrop" data-modal-close></div>
    <div class="td-modal-dialog" role="dialog" aria-labelledby="${id}-title">
      <div class="td-modal-header">
        <h2 id="${id}-title">${title}</h2>
        <button class="td-modal-close" data-modal-close aria-label="Close">&times;</button>
      </div>
      <div class="td-modal-body"></div>
    </div>`;
  const body = wrapper.querySelector('.td-modal-body')!;
  if (typeof content === 'string') body.innerHTML = content; else body.appendChild(content);
  wrapper.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.matches('[data-modal-close]')) {
      wrapper.remove();
      onClose?.();
    }
  });
  return wrapper;
}

export function showModal(opts: ModalOptions) {
  const el = createModal(opts);
  document.body.appendChild(el);
  requestAnimationFrame(()=> el.classList.add('td-modal-visible'));
  return el.id;
}
