/**
 * Pure functions for balance computation.
 * These are also used by Jest unit tests.
 */

/**
 * Calculate net balance per roommate ID.
 * Positive = others owe them; Negative = they owe others.
 * @param {Array} roommates  - [{id, name}]
 * @param {Array} expenses   - [{paidBy, amount, participants, splits, splitType}]
 * @param {Array} payments   - [{from, to, amount}]
 * @returns {Object} { roommateId: netBalance }
 */
export function calculateBalances(roommates, expenses, payments) {
  const balances = {};
  for (const r of roommates) balances[r.id] = 0;

  for (const exp of expenses) {
    const total = parseFloat(exp.amount) || 0;
    const participants = exp.participants || [];
    if (participants.length === 0) continue;

    // Credit payer
    if (balances[exp.paidBy] !== undefined) {
      balances[exp.paidBy] += total;
    }

    // Debit each participant
    if (exp.splitType === 'unequal' && exp.splits) {
      for (const [pid, amt] of Object.entries(exp.splits)) {
        if (balances[pid] !== undefined) {
          balances[pid] -= parseFloat(amt) || 0;
        }
      }
    } else {
      // Equal split
      const share = total / participants.length;
      for (const pid of participants) {
        if (balances[pid] !== undefined) {
          balances[pid] -= share;
        }
      }
    }
  }

  // Apply payments: 'from' pays 'to'. 
  // The 'from' person is paying off a debt, so their net balance increases (gets closer to 0 or positive).
  // The 'to' person receives money they were owed, so their net balance decreases.
  for (const pmt of payments) {
    const amt = parseFloat(pmt.amount) || 0;
    if (balances[pmt.from] !== undefined) balances[pmt.from] += amt;
    if (balances[pmt.to] !== undefined) balances[pmt.to] -= amt;
  }

  // Round to 2dp
  for (const k of Object.keys(balances)) {
    balances[k] = Math.round(balances[k] * 100) / 100;
  }

  return balances;
}

/**
 * Simplify debts: reduce N pairwise debts to minimum transactions.
 * @param {Object} balances - { roommateId: netBalance }
 * @param {Array}  roommates - [{id, name}]
 * @returns {Array} [{from, to, amount}]
 */
export function simplifyDebts(balances, roommates) {
  const nameMap = {};
  for (const r of roommates) nameMap[r.id] = r.name;

  const creditors = [];
  const debtors = [];

  for (const [id, bal] of Object.entries(balances)) {
    if (bal > 0.01) creditors.push({ id, bal });
    else if (bal < -0.01) debtors.push({ id, bal: -bal });
  }

  const transactions = [];
  let ci = 0, di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const c = creditors[ci];
    const d = debtors[di];
    const amt = Math.min(c.bal, d.bal);
    transactions.push({
      from: d.id,
      fromName: nameMap[d.id] || d.id,
      to: c.id,
      toName: nameMap[c.id] || c.id,
      amount: Math.round(amt * 100) / 100
    });
    c.bal -= amt;
    d.bal -= amt;
    if (c.bal < 0.01) ci++;
    if (d.bal < 0.01) di++;
  }

  return transactions;
}

/** Sum all expense amounts */
export function getTotalSpent(expenses) {
  return expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
}

/** Get how much a specific member paid */
export function getMemberPaid(expenses, memberId) {
  return expenses
    .filter(e => e.paidBy === memberId)
    .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
}

/** Get share owed by a specific member */
export function getMemberShare(expenses, memberId) {
  let total = 0;
  for (const exp of expenses) {
    const participants = exp.participants || [];
    if (!participants.includes(memberId)) continue;
    if (exp.splitType === 'unequal' && exp.splits && exp.splits[memberId]) {
      total += parseFloat(exp.splits[memberId]) || 0;
    } else if (participants.length > 0) {
      total += (parseFloat(exp.amount) || 0) / participants.length;
    }
  }
  return Math.round(total * 100) / 100;
}
