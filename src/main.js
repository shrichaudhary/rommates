import { auth } from './firebase.js';
import { signUpWithEmail, signInWithEmail, signInWithGoogle, signOut, onAuthStateChanged, getUserDoc } from './auth.js';
import { createHouse, joinHouseByCode, getHouseDoc, listenHouse, detectJoinCodeFromURL, buildInviteUrl } from './house.js';
import { listenRoommates, addRoommate, removeRoommate, memberAvatar } from './roommates.js';
import { listenExpenses, addExpense, updateExpense, deleteExpense, readReceiptAsBase64, CATEGORY_EMOJI, CATEGORY_COLORS } from './expenses.js';
import { listenPayments, addPayment, updatePayment, deletePayment } from './payments.js';
import { calculateBalances, simplifyDebts, getTotalSpent, getMemberPaid, getMemberShare } from './balances.js';
import { exportHouseData, importHouseData } from './export-import.js';
import { showToast } from './toast.js';
import { openModal, closeModal, confirm, showView, fmt, fmtDate, todayISO, setLoading, populateMonthFilters } from './ui.js';
import { Chart, ArcElement, Tooltip, Legend, PieController } from 'chart.js';

Chart.register(ArcElement, Tooltip, Legend, PieController);

// ── App State ──────────────────────────────────────────────────────────────
let currentUser = null;
let userDoc = null;
let houseData = null;
let roommates = [];
let expenses = [];
let payments = [];
let receiptBase64 = null;
let balanceChart = null;
let initialLoad = { expenses: true, payments: true };
let unsubListeners = [];

// ── Auth Flow ──────────────────────────────────────────────────────────────
onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    userDoc = await getUserDoc(user.uid);
    const joinCode = detectJoinCodeFromURL();
    if (joinCode) {
      try {
        houseData = await joinHouseByCode(joinCode, user);
        window.history.replaceState({}, '', window.location.pathname);
        showToast(`Joined house: ${houseData.name}!`, 'success');
      } catch (e) { showToast(e.message, 'error'); }
    }
    userDoc = await getUserDoc(user.uid);
    await initApp();
  } else {
    currentUser = null;
    houseData = null;
    unsubAll();
    showAuthScreen();
  }
  hideLoading();
});

function hideLoading() {
  document.getElementById('loading-screen').style.display = 'none';
}

function showAuthScreen() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app-screen').classList.add('hidden');
  if (detectJoinCodeFromURL()) {
    document.getElementById('join-notice').classList.remove('hidden');
  }
}

async function initApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');

  if (userDoc?.houseId) {
    houseData = await getHouseDoc(userDoc.houseId);
  }

  renderUserInfo();

  if (!houseData) {
    showView('house-setup');
    return;
  }

  startListeners();
  renderHouseInfo();
  showView('dashboard');
}

function unsubAll() {
  unsubListeners.forEach(fn => fn());
  unsubListeners = [];
}

function startListeners() {
  unsubAll();
  initialLoad = { expenses: true, payments: true };

  unsubListeners.push(
    listenRoommates(houseData.id, (list) => {
      roommates = list;
      renderRoommates();
      renderDashboard();
    })
  );

  unsubListeners.push(
    listenExpenses(houseData.id, (list, changes) => {
      if (!initialLoad.expenses) {
        changes.forEach(ch => {
          if (ch.type === 'added') {
            const e = ch.doc.data();
            const payer = roommates.find(r => r.id === e.paidBy);
            if (e.creatorUid !== currentUser?.uid) {
              showToast(`New expense "${e.description}" added by ${payer?.name || 'Someone'}`, 'info');
            }
          }
        });
      }
      initialLoad.expenses = false;
      expenses = list;
      renderExpenses();
      renderDashboard();
      populateMonthFilters(expenses, 'month-filter', 'expense-month-filter');
    })
  );

  unsubListeners.push(
    listenPayments(houseData.id, (list, changes) => {
      if (!initialLoad.payments) {
        changes.forEach(ch => {
          if (ch.type === 'added') {
            const p = ch.doc.data();
            if (p.creatorUid !== currentUser?.uid) {
              showToast(`New payment recorded`, 'info');
            }
          }
        });
      }
      initialLoad.payments = false;
      payments = list;
      renderPayments();
      renderDashboard();
    })
  );

  unsubListeners.push(
    listenHouse(houseData.id, (data) => {
      houseData = data;
      renderHouseInfo();
    })
  );
}

// ── Render: User Info ──────────────────────────────────────────────────────
function renderUserInfo() {
  const el = document.getElementById('user-info');
  if (!el || !currentUser) return;
  el.innerHTML = `
    ${memberAvatar(currentUser.displayName || currentUser.email, 32)}
    <span class="user-name">${currentUser.displayName || currentUser.email}</span>
  `;
}

// ── Render: House Info ─────────────────────────────────────────────────────
function renderHouseInfo() {
  const el = document.getElementById('house-info');
  if (!el || !houseData) return;
  el.innerHTML = `<div class="house-name-display">🏠 ${houseData.name}</div>`;
}

// ── Render: Dashboard ──────────────────────────────────────────────────────
function renderDashboard() {
  if (!houseData) return;
  const monthFilter = document.getElementById('month-filter')?.value || 'all';
  const filtered = monthFilter === 'all' ? expenses : expenses.filter(e => e.date?.startsWith(monthFilter));
  const balances = calculateBalances(roommates, filtered, payments);
  const simplifications = simplifyDebts(balances, roommates);
  const totalSpent = getTotalSpent(filtered);
  const myMember = roommates.find(r => r.uid === currentUser?.uid);
  const myId = myMember?.id;
  const myPaid = myId ? getMemberPaid(filtered, myId) : 0;
  const myShare = myId ? getMemberShare(filtered, myId) : 0;
  const myNet = myId ? (balances[myId] || 0) : 0;

  document.getElementById('stat-total-value').textContent = fmt(totalSpent);
  document.getElementById('stat-myshare-value').textContent = fmt(myShare);
  document.getElementById('stat-ipaid-value').textContent = fmt(myPaid);
  const netEl = document.getElementById('stat-net-value');
  netEl.textContent = (myNet >= 0 ? '+' : '-') + fmt(myNet);
  netEl.className = 'stat-value ' + (myNet >= 0 ? 'text-green' : 'text-red');
  document.getElementById('stat-net-icon').textContent = myNet >= 0 ? '📈' : '📉';

  // Balances list
  const balEl = document.getElementById('balances-list');
  if (balEl) {
    balEl.innerHTML = roommates.map(r => {
      const b = balances[r.id] || 0;
      const cls = b > 0 ? 'text-green' : b < 0 ? 'text-red' : 'text-muted';
      const label = b > 0.01 ? 'gets back' : b < -0.01 ? 'owes' : 'settled';
      return `<div class="balance-row">
        ${memberAvatar(r.name, 36)}
        <span class="balance-name">${r.name}</span>
        <span class="balance-amount ${cls}">${b >= 0 ? '+' : ''}${fmt(b)} <small>${label}</small></span>
      </div>`;
    }).join('');
  }

  // Debts list
  const debtsEl = document.getElementById('debts-list');
  if (debtsEl) {
    debtsEl.innerHTML = simplifications.length
      ? simplifications.map(t => `
          <div class="debt-row">
            ${memberAvatar(t.fromName, 30)}
            <span class="debt-from">${t.fromName}</span>
            <span class="debt-arrow">→</span>
            ${memberAvatar(t.toName, 30)}
            <span class="debt-to">${t.toName}</span>
            <span class="debt-amount text-amber">${fmt(t.amount)}</span>
            <button class="btn btn-success btn-xs settle-btn"
              data-from="${t.from}" data-to="${t.to}" data-amount="${t.amount}"
              data-fromname="${t.fromName}" data-toname="${t.toName}">Settle</button>
          </div>`).join('')
      : '<p class="text-muted text-center">All settled up! 🎉</p>';
    debtsEl.querySelectorAll('.settle-btn').forEach(btn => {
      btn.addEventListener('click', () => quickSettle(btn.dataset));
    });
  }

  updateChart(balances);

  const recentEl = document.getElementById('recent-expenses-list');
  if (recentEl) {
    recentEl.innerHTML = filtered.slice(0, 5).map(e => expenseCard(e)).join('') || '<p class="text-muted">No expenses yet.</p>';
    attachExpenseCardListeners(recentEl);
  }
}

function updateChart(balances) {
  const palette = ['#6c63ff','#f06292','#4db6ac','#ff8a65','#aed581','#ffb74d','#64b5f6','#ba68c8'];
  const labels = roommates.map(r => r.name);
  const data = roommates.map(r => Math.abs(balances[r.id] || 0));
  const ctx = document.getElementById('balance-chart');
  if (!ctx) return;
  if (balanceChart) balanceChart.destroy();
  balanceChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels,
      datasets: [{ data, backgroundColor: roommates.map((_, i) => palette[i % palette.length]), borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)' }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { color: 'var(--text-primary)', font: { family: 'Inter' } } },
        tooltip: { callbacks: { label: c => `${c.label}: ${fmt(c.parsed)}` } }
      }
    }
  });
}

// ── Render: Expenses ───────────────────────────────────────────────────────
function renderExpenses() {
  const container = document.getElementById('expenses-list');
  if (!container) return;
  const mf = document.getElementById('expense-month-filter')?.value || 'all';
  const cf = document.getElementById('expense-category-filter')?.value || 'all';
  let list = expenses;
  if (mf !== 'all') list = list.filter(e => e.date?.startsWith(mf));
  if (cf !== 'all') list = list.filter(e => e.category === cf);
  container.innerHTML = list.map(e => expenseCard(e)).join('') || '<p class="text-muted text-center mt-4">No expenses found.</p>';
  attachExpenseCardListeners(container);
}

function expenseCard(e) {
  const payer = roommates.find(r => r.id === e.paidBy);
  const emoji = CATEGORY_EMOJI[e.category] || '📦';
  const color = CATEGORY_COLORS[e.category] || '#6c63ff';
  const isOwner = e.creatorUid === currentUser?.uid;
  const participantNames = (e.participants || []).map(pid => roommates.find(r => r.id === pid)?.name || '?').join(', ');
  return `<div class="card expense-card" data-id="${e.id}">
    <div class="card-left">
      <div class="category-badge" style="background:${color}22;color:${color}">${emoji}</div>
      <div class="card-info">
        <div class="card-title">${e.description} ${e.recurring ? '🔁' : ''}</div>
        <div class="card-meta">${fmtDate(e.date)} · Paid by ${payer?.name || '?'} · ${participantNames}</div>
      </div>
    </div>
    <div class="card-right">
      <div class="card-amount">${fmt(e.amount)}</div>
      ${isOwner ? `<div class="card-actions">
        <button class="btn btn-ghost btn-xs edit-expense-btn" data-id="${e.id}" aria-label="Edit expense">✏️</button>
        <button class="btn btn-ghost btn-xs delete-expense-btn" data-id="${e.id}" aria-label="Delete expense">🗑️</button>
      </div>` : ''}
      ${e.receiptBase64 ? `<button class="btn btn-ghost btn-xs view-receipt-btn" data-id="${e.id}" aria-label="View receipt">🧾</button>` : ''}
    </div>
  </div>`;
}

function attachExpenseCardListeners(container) {
  container.querySelectorAll('.edit-expense-btn').forEach(btn => {
    btn.addEventListener('click', () => openExpenseModal(expenses.find(e => e.id === btn.dataset.id)));
  });
  container.querySelectorAll('.delete-expense-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (await confirm('Delete this expense?', 'Delete Expense')) {
        await deleteExpense(houseData.id, btn.dataset.id);
        showToast('Expense deleted.', 'success');
      }
    });
  });
  container.querySelectorAll('.view-receipt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const exp = expenses.find(e => e.id === btn.dataset.id);
      if (exp?.receiptBase64) {
        const w = window.open(); w.document.write(`<img src="${exp.receiptBase64}" style="max-width:100%;"/>`);
      }
    });
  });
}

// ── Render: Payments ───────────────────────────────────────────────────────
function renderPayments() {
  const container = document.getElementById('payments-list');
  if (!container) return;
  container.innerHTML = payments.map(p => {
    const fromR = roommates.find(r => r.id === p.from);
    const toR = roommates.find(r => r.id === p.to);
    const isOwner = p.creatorUid === currentUser?.uid;
    return `<div class="card payment-card" data-id="${p.id}">
      <div class="card-left">
        <div class="category-badge" style="background:#4db6ac22;color:#4db6ac">💳</div>
        <div class="card-info">
          <div class="card-title">${fromR?.name || '?'} → ${toR?.name || '?'}</div>
          <div class="card-meta">${fmtDate(p.date)}${p.note ? ' · ' + p.note : ''}</div>
        </div>
      </div>
      <div class="card-right">
        <div class="card-amount text-green">${fmt(p.amount)}</div>
        ${isOwner ? `<div class="card-actions">
          <button class="btn btn-ghost btn-xs edit-payment-btn" data-id="${p.id}" aria-label="Edit payment">✏️</button>
          <button class="btn btn-ghost btn-xs delete-payment-btn" data-id="${p.id}" aria-label="Delete payment">🗑️</button>
        </div>` : ''}
      </div>
    </div>`;
  }).join('') || '<p class="text-muted text-center mt-4">No payments recorded.</p>';

  container.querySelectorAll('.edit-payment-btn').forEach(btn => {
    btn.addEventListener('click', () => openPaymentModal(payments.find(p => p.id === btn.dataset.id)));
  });
  container.querySelectorAll('.delete-payment-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (await confirm('Delete this payment?', 'Delete Payment')) {
        await deletePayment(houseData.id, btn.dataset.id);
        showToast('Payment deleted.', 'success');
      }
    });
  });
}

// ── Render: Roommates ──────────────────────────────────────────────────────
function renderRoommates() {
  const grid = document.getElementById('roommates-grid');
  if (!grid) return;
  const isCreator = houseData?.creatorUid === currentUser?.uid;
  grid.innerHTML = roommates.map(r => `
    <div class="roommate-card glass">
      ${memberAvatar(r.name, 64)}
      <div class="roommate-name">${r.name}</div>
      <div class="roommate-email text-muted">${r.email || ''}</div>
      ${r.isOwner ? '<div class="badge badge-primary">Owner</div>' : ''}
      ${isCreator && !r.isOwner ? `<button class="btn btn-danger btn-xs remove-roommate-btn" data-id="${r.id}" data-name="${r.name}">Remove</button>` : ''}
    </div>
  `).join('');
  grid.querySelectorAll('.remove-roommate-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (await confirm(`Remove ${btn.dataset.name}?`, 'Remove Member')) {
        await removeRoommate(houseData.id, btn.dataset.id);
        showToast(`${btn.dataset.name} removed.`, 'success');
      }
    });
  });
}

// ── Render: Activity ───────────────────────────────────────────────────────
function renderActivity() {
  const list = document.getElementById('activity-list');
  if (!list) return;
  const events = [
    ...expenses.map(e => ({ ...e, _type: 'expense', _sort: e.date || '' })),
    ...payments.map(p => ({ ...p, _type: 'payment', _sort: p.date || '' }))
  ].sort((a, b) => (a._sort > b._sort ? -1 : 1));

  list.innerHTML = events.slice(0, 50).map(ev => {
    if (ev._type === 'expense') {
      const payer = roommates.find(r => r.id === ev.paidBy);
      return `<div class="card activity-item">
        <span class="activity-icon">${CATEGORY_EMOJI[ev.category] || '💰'}</span>
        <div class="activity-body">
          <div class="activity-title"><strong>${payer?.name || '?'}</strong> paid <strong>${fmt(ev.amount)}</strong> for "${ev.description}"</div>
          <div class="activity-meta text-muted">${fmtDate(ev.date)}</div>
        </div>
      </div>`;
    }
    const fromR = roommates.find(r => r.id === ev.from);
    const toR = roommates.find(r => r.id === ev.to);
    return `<div class="card activity-item">
      <span class="activity-icon">💳</span>
      <div class="activity-body">
        <div class="activity-title"><strong>${fromR?.name || '?'}</strong> paid <strong>${fmt(ev.amount)}</strong> to <strong>${toR?.name || '?'}</strong></div>
        <div class="activity-meta text-muted">${fmtDate(ev.date)}</div>
      </div>
    </div>`;
  }).join('') || '<p class="text-muted text-center mt-4">No activity yet.</p>';
}

// ── Modal: Expense ─────────────────────────────────────────────────────────
function openExpenseModal(exp = null) {
  receiptBase64 = null;
  document.getElementById('modal-expense-title').textContent = exp ? 'Edit Expense' : 'Add Expense';
  document.getElementById('expense-id').value = exp?.id || '';
  document.getElementById('expense-desc').value = exp?.description || '';
  document.getElementById('expense-amount').value = exp?.amount || '';
  document.getElementById('expense-date').value = exp?.date || todayISO();
  document.getElementById('expense-category').value = exp?.category || 'other';
  document.getElementById('expense-split').value = exp?.splitType || 'equal';
  document.getElementById('expense-recurring').checked = exp?.recurring || false;
  document.getElementById('receipt-preview').classList.add('hidden');
  document.getElementById('receipt-status').textContent = '';
  if (exp?.receiptBase64) { receiptBase64 = exp.receiptBase64; }

  // Populate payer dropdown
  const payerSel = document.getElementById('expense-payer');
  payerSel.innerHTML = roommates.map(r => `<option value="${r.id}" ${exp?.paidBy === r.id ? 'selected' : ''}>${r.name}</option>`).join('');

  // Populate participants
  const parts = document.getElementById('expense-participants');
  parts.innerHTML = roommates.map(r => `
    <label class="checkbox-label">
      <input type="checkbox" name="participant" value="${r.id}" ${!exp || (exp.participants || []).includes(r.id) ? 'checked' : ''} aria-label="${r.name}" />
      ${r.name}
    </label>`).join('');

  toggleUnequalSplits(exp);
  openModal('modal-expense');
}

function toggleUnequalSplits(exp = null) {
  const splitType = document.getElementById('expense-split').value;
  const uneqDiv = document.getElementById('unequal-splits');
  if (splitType === 'unequal') {
    uneqDiv.classList.remove('hidden');
    const amtsDiv = document.getElementById('split-amounts');
    const selected = [...document.querySelectorAll('input[name="participant"]:checked')].map(cb => cb.value);
    amtsDiv.innerHTML = selected.map(pid => {
      const r = roommates.find(m => m.id === pid);
      const val = exp?.splits?.[pid] || '';
      return `<div class="split-row">
        <label for="split-${pid}">${r?.name || pid}</label>
        <input type="number" id="split-${pid}" class="split-input" data-pid="${pid}" value="${val}" placeholder="0.00" min="0" step="0.01" aria-label="${r?.name || pid} amount" />
      </div>`;
    }).join('');
  } else {
    uneqDiv.classList.add('hidden');
  }
}

// ── Modal: Payment ─────────────────────────────────────────────────────────
function openPaymentModal(pmt = null) {
  document.getElementById('modal-payment-title').textContent = pmt ? 'Edit Payment' : 'Record Payment';
  document.getElementById('payment-id').value = pmt?.id || '';
  document.getElementById('payment-amount').value = pmt?.amount || '';
  document.getElementById('payment-date').value = pmt?.date || todayISO();
  document.getElementById('payment-note').value = pmt?.note || '';

  const fromSel = document.getElementById('payment-from');
  const toSel = document.getElementById('payment-to');
  fromSel.innerHTML = roommates.map(r => `<option value="${r.id}" ${pmt?.from === r.id ? 'selected' : ''}>${r.name}</option>`).join('');
  toSel.innerHTML = roommates.map(r => `<option value="${r.id}" ${pmt?.to === r.id ? 'selected' : ''}>${r.name}</option>`).join('');
  openModal('modal-payment');
}

// ── Quick Settle ───────────────────────────────────────────────────────────
async function quickSettle({ from, to, amount, fromname, toname }) {
  if (!await confirm(`Record payment of ${fmt(amount)} from ${fromname} to ${toname}?`, 'Quick Settle')) return;
  await addPayment(houseData.id, {
    from, to, amount: parseFloat(amount), date: todayISO(), note: 'Quick settle'
  }, currentUser.uid);
  showToast('Payment recorded!', 'success');
}

// ── Settle All ─────────────────────────────────────────────────────────────
async function settleAll() {
  const balances = calculateBalances(roommates, expenses, payments);
  const txns = simplifyDebts(balances, roommates);
  if (!txns.length) { showToast('Everyone is already settled!', 'info'); return; }
  if (!await confirm(`Record ${txns.length} settlement payment(s)?`, 'Settle All')) return;
  for (const t of txns) {
    await addPayment(houseData.id, {
      from: t.from, to: t.to, amount: t.amount, date: todayISO(), note: 'Settle all'
    }, currentUser.uid);
  }
  showToast('All settlements recorded!', 'success');
}

// ── Event Handlers ─────────────────────────────────────────────────────────
// Auth tabs
document.getElementById('tab-signin').addEventListener('click', () => {
  document.getElementById('tab-signin').classList.add('active');
  document.getElementById('tab-signup').classList.remove('active');
  document.getElementById('signin-form').classList.remove('hidden');
  document.getElementById('signup-form').classList.add('hidden');
});
document.getElementById('tab-signup').addEventListener('click', () => {
  document.getElementById('tab-signup').classList.add('active');
  document.getElementById('tab-signin').classList.remove('active');
  document.getElementById('signup-form').classList.remove('hidden');
  document.getElementById('signin-form').classList.add('hidden');
});

// Sign in
document.getElementById('signin-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btn-signin');
  setLoading(btn, true, 'Signing in…');
  try {
    await signInWithEmail(document.getElementById('signin-email').value, document.getElementById('signin-password').value);
  } catch (err) { showToast(err.message, 'error'); }
  setLoading(btn, false);
});

// Sign up
document.getElementById('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btn-signup');
  setLoading(btn, true, 'Creating account…');
  try {
    await signUpWithEmail(document.getElementById('signup-name').value, document.getElementById('signup-email').value, document.getElementById('signup-password').value);
  } catch (err) { showToast(err.message, 'error'); }
  setLoading(btn, false);
});

// Google sign in
document.getElementById('btn-google').addEventListener('click', async () => {
  try { await signInWithGoogle(); } catch (err) { showToast(err.message, 'error'); }
});

// Sign out
document.getElementById('btn-signout').addEventListener('click', async () => {
  await signOut(); showToast('Signed out.', 'info');
});

// Create house
document.getElementById('create-house-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btn-create-house');
  setLoading(btn, true, 'Creating…');
  try {
    houseData = await createHouse(document.getElementById('house-name').value.trim(), currentUser);
    startListeners(); renderHouseInfo(); showView('dashboard');
    showToast(`House "${houseData.name}" created!`, 'success');
  } catch (err) { showToast(err.message, 'error'); }
  setLoading(btn, false);
});

// Nav items
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    showView(btn.dataset.view);
    if (btn.dataset.view === 'activity') renderActivity();
  });
});

// Invite
document.getElementById('btn-invite').addEventListener('click', () => {
  if (!houseData) return;
  const url = buildInviteUrl(houseData.joinCode);
  document.getElementById('invite-link-input').value = url;
  document.getElementById('join-code-text').textContent = houseData.joinCode;
  openModal('modal-invite');
});
document.getElementById('btn-copy-link').addEventListener('click', () => {
  navigator.clipboard.writeText(document.getElementById('invite-link-input').value);
  showToast('Link copied!', 'success');
});

// Export/Import
document.getElementById('btn-export').addEventListener('click', () => {
  if (houseData) exportHouseData(houseData.id, houseData.name);
});
document.getElementById('import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return;
  const text = await file.text();
  if (houseData) await importHouseData(houseData.id, text);
  e.target.value = '';
});

// Add expense button
document.getElementById('btn-add-expense').addEventListener('click', () => openExpenseModal());

// Expense form
document.getElementById('expense-split').addEventListener('change', () => toggleUnequalSplits());
document.querySelectorAll('input[name="participant"]').forEach(cb => cb.addEventListener('change', () => toggleUnequalSplits()));

// Receipt upload
document.getElementById('expense-receipt').addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return;
  try {
    receiptBase64 = await readReceiptAsBase64(file);
    document.getElementById('receipt-status').textContent = `✅ ${(file.size/1024).toFixed(1)} KB`;
    const img = document.getElementById('receipt-img');
    img.src = receiptBase64;
    document.getElementById('receipt-preview').classList.remove('hidden');
  } catch (err) {
    showToast(err.message, 'error');
    e.target.value = '';
    receiptBase64 = null;
  }
});
document.getElementById('btn-remove-receipt').addEventListener('click', () => {
  receiptBase64 = null;
  document.getElementById('expense-receipt').value = '';
  document.getElementById('receipt-preview').classList.add('hidden');
  document.getElementById('receipt-status').textContent = '';
});

// Expense form submit
document.getElementById('expense-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btn-save-expense');
  setLoading(btn, true, 'Saving…');
  try {
    const id = document.getElementById('expense-id').value;
    const splitType = document.getElementById('expense-split').value;
    const participants = [...document.querySelectorAll('input[name="participant"]:checked')].map(cb => cb.value);
    if (!participants.length) { showToast('Select at least one participant.', 'error'); setLoading(btn, false); return; }

    let splits = null;
    if (splitType === 'unequal') {
      splits = {};
      document.querySelectorAll('.split-input').forEach(inp => { splits[inp.dataset.pid] = parseFloat(inp.value) || 0; });
    }

    const data = {
      description: document.getElementById('expense-desc').value.trim(),
      amount: parseFloat(document.getElementById('expense-amount').value),
      paidBy: document.getElementById('expense-payer').value,
      date: document.getElementById('expense-date').value,
      category: document.getElementById('expense-category').value,
      splitType,
      recurring: document.getElementById('expense-recurring').checked,
      participants,
      splits,
      receiptBase64: receiptBase64 || null
    };

    if (id) { await updateExpense(houseData.id, id, data); showToast('Expense updated!', 'success'); }
    else { await addExpense(houseData.id, data, currentUser.uid); showToast('Expense added!', 'success'); }
    closeModal('modal-expense');
  } catch (err) { showToast(err.message, 'error'); }
  setLoading(btn, false);
});

// Add payment button
document.getElementById('btn-add-payment').addEventListener('click', () => openPaymentModal());

// Payment form submit
document.getElementById('payment-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btn-save-payment');
  setLoading(btn, true, 'Saving…');
  try {
    const id = document.getElementById('payment-id').value;
    const data = {
      from: document.getElementById('payment-from').value,
      to: document.getElementById('payment-to').value,
      amount: parseFloat(document.getElementById('payment-amount').value),
      date: document.getElementById('payment-date').value,
      note: document.getElementById('payment-note').value.trim()
    };
    if (data.from === data.to) { showToast('Payer and receiver cannot be the same.', 'error'); setLoading(btn, false); return; }
    if (id) { await updatePayment(houseData.id, id, data); showToast('Payment updated!', 'success'); }
    else { await addPayment(houseData.id, data, currentUser.uid); showToast('Payment recorded!', 'success'); }
    closeModal('modal-payment');
  } catch (err) { showToast(err.message, 'error'); }
  setLoading(btn, false);
});

// Add roommate button
document.getElementById('btn-add-roommate').addEventListener('click', () => {
  document.getElementById('roommate-name').value = '';
  document.getElementById('roommate-email').value = '';
  openModal('modal-roommate');
});

// Roommate form submit
document.getElementById('roommate-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btn-save-roommate');
  setLoading(btn, true, 'Adding…');
  try {
    await addRoommate(houseData.id, { name: document.getElementById('roommate-name').value.trim(), email: document.getElementById('roommate-email').value.trim() });
    showToast('Member added!', 'success');
    closeModal('modal-roommate');
  } catch (err) { showToast(err.message, 'error'); }
  setLoading(btn, false);
});

// Settle All
document.getElementById('btn-settle-all').addEventListener('click', settleAll);

// Month filter (dashboard)
document.getElementById('month-filter').addEventListener('change', renderDashboard);

// Expense filters
document.getElementById('expense-month-filter').addEventListener('change', renderExpenses);
document.getElementById('expense-category-filter').addEventListener('change', renderExpenses);

// Close modals via close buttons and overlay click
document.querySelectorAll('.btn-close, [data-modal]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const target = btn.dataset.modal || btn.closest('.modal-overlay')?.id;
    if (target) closeModal(target);
  });
});
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

// Mobile menu toggle
document.getElementById('btn-menu-toggle').addEventListener('click', () => {
  const sidebar = document.getElementById('sidebar');
  const isOpen = sidebar.classList.toggle('open');
  document.getElementById('btn-menu-toggle').setAttribute('aria-expanded', String(isOpen));
});

// Theme toggle
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
document.getElementById('btn-theme-toggle').textContent = savedTheme === 'dark' ? '🌙' : '☀️';
document.getElementById('btn-theme-toggle').addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  document.getElementById('btn-theme-toggle').textContent = next === 'dark' ? '🌙' : '☀️';
});

// PWA service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
