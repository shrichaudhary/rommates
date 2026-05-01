/** Shared UI helpers */

/** Open a modal by its ID */
export function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (!el) return;
  el.classList.remove('hidden');
  // Focus first input for accessibility
  setTimeout(() => {
    const first = el.querySelector('input:not([type="hidden"]), select, textarea');
    if (first) first.focus();
  }, 100);
}

/** Close a modal by its ID */
export function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.add('hidden');
}

/** Show a confirm dialog, returns a Promise<boolean> */
export function confirm(message, title = 'Confirm') {
  return new Promise((resolve) => {
    const modal = document.getElementById('modal-confirm');
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    modal.classList.remove('hidden');

    const ok = document.getElementById('btn-confirm-ok');
    const cancel = document.getElementById('btn-confirm-cancel');

    const cleanup = (result) => {
      modal.classList.add('hidden');
      ok.replaceWith(ok.cloneNode(true));
      cancel.replaceWith(cancel.cloneNode(true));
      resolve(result);
    };

    document.getElementById('btn-confirm-ok').addEventListener('click', () => cleanup(true), { once: true });
    document.getElementById('btn-confirm-cancel').addEventListener('click', () => cleanup(false), { once: true });
  });
}

/** Switch the active nav item and visible view */
export function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  const target = document.getElementById(`view-${viewId}`);
  if (target) target.classList.remove('hidden');

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewId);
  });
  // Close sidebar on mobile
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('btn-menu-toggle')?.setAttribute('aria-expanded', 'false');
}

/** Format currency */
export function fmt(amount) {
  return `₹${Math.abs(amount).toFixed(2)}`;
}

/** Format date string (YYYY-MM-DD) to locale */
export function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Get today's date as YYYY-MM-DD */
export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Set loading state on a button */
export function setLoading(btn, loading, text = 'Loading…') {
  if (!btn) return;
  if (loading) {
    btn.dataset.origText = btn.textContent;
    btn.textContent = text;
    btn.disabled = true;
  } else {
    btn.textContent = btn.dataset.origText || 'Save';
    btn.disabled = false;
  }
}

/** Populate month filter dropdowns from a list of expense dates */
export function populateMonthFilters(expenses, ...selectIds) {
  const months = new Set();
  for (const e of expenses) {
    if (e.date) months.add(e.date.slice(0, 7));
  }
  const sorted = [...months].sort().reverse();
  for (const id of selectIds) {
    const sel = document.getElementById(id);
    if (!sel) continue;
    const cur = sel.value;
    // Keep "All Time" option
    sel.innerHTML = '<option value="all">All Time</option>';
    for (const m of sorted) {
      const [y, mo] = m.split('-');
      const label = new Date(+y, +mo - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
      sel.insertAdjacentHTML('beforeend', `<option value="${m}">${label}</option>`);
    }
    if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
  }
}
