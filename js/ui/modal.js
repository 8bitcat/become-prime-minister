// Dialoger och toasts.
import { h, esc } from '../core/util.js';

const root = () => document.getElementById('modals');

export function modal({ title, body, buttons = [], wide = false, closable = true, stack = false, onClose = null }) {
  const bg = h('div', { class: 'modal-bg' });
  const m = h('div', { class: 'modal' + (wide ? ' wide' : '') });
  const close = () => { bg.remove(); onClose?.(); };
  const head = h('div', { class: 'mh' }, h('h2', {}, title));
  if (closable) head.append(h('button', { class: 'xclose', onclick: close, 'aria-label': 'Stäng' }, '×'));
  m.append(head);
  const mb = h('div', { class: 'mb' });
  if (typeof body === 'string') mb.innerHTML = body; else if (body) mb.append(body);
  m.append(mb);
  if (buttons.length) {
    const mf = h('div', { class: 'mf' + (stack ? ' stack' : '') });
    for (const b of buttons) {
      const btn = h('button', { class: 'btn ' + (b.cls || ''), disabled: b.disabled || false }, b.label);
      btn.addEventListener('click', () => { const r = b.onClick?.(btn); if (b.close !== false && r !== false) close(); });
      mf.append(btn);
    }
    m.append(mf);
  }
  bg.append(m);
  if (closable) bg.addEventListener('click', (e) => { if (e.target === bg) close(); });
  root().append(bg);
  return { el: m, close, body: mb };
}

export function choice({ title, text, choices, wide = false }) {
  return new Promise((resolve) => {
    const list = h('div', { class: 'choice' });
    choices.forEach((c, i) => {
      const b = h('button', { class: 'btn ' + (c.cls || ''), disabled: c.disabled || false });
      b.innerHTML = `${esc(c.label)}${c.desc ? `<small>${esc(c.desc)}</small>` : ''}`;
      b.addEventListener('click', () => { m.close(); resolve(i); });
      list.append(b);
    });
    const body = h('div', {});
    if (text) { const p = h('div', { class: 'help', style: 'margin-bottom:14px;font-size:15px;color:var(--text)' }); p.innerHTML = text; body.append(p); }
    body.append(list);
    const m = modal({ title, body, closable: false, wide });
  });
}

export function info(title, html, label = 'OK') {
  return new Promise((resolve) => modal({ title, body: html, buttons: [{ label, cls: 'gold', onClick: () => resolve() }], closable: false }));
}

export function toast(msg, kind = '') {
  const t = h('div', { class: 'toast ' + kind }); t.innerHTML = msg;
  document.getElementById('toasts').append(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .4s'; setTimeout(() => t.remove(), 400); }, 3600);
}
