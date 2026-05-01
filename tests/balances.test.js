import { describe, it, expect } from '@jest/globals';
import { calculateBalances, simplifyDebts, getTotalSpent } from '../src/balances.js';

const roommates = [
  { id: 'alice', name: 'Alice' },
  { id: 'bob',   name: 'Bob'   },
  { id: 'carol', name: 'Carol' }
];

describe('calculateBalances', () => {
  it('returns zero balances with no expenses or payments', () => {
    const b = calculateBalances(roommates, [], []);
    expect(b).toEqual({ alice: 0, bob: 0, carol: 0 });
  });

  it('equal split: payer gets credit, others get debit', () => {
    const expenses = [{
      paidBy: 'alice', amount: '90', splitType: 'equal',
      participants: ['alice', 'bob', 'carol']
    }];
    const b = calculateBalances(roommates, expenses, []);
    expect(b.alice).toBeCloseTo(60);   // paid 90, owes 30 → net +60
    expect(b.bob).toBeCloseTo(-30);
    expect(b.carol).toBeCloseTo(-30);
  });

  it('unequal split: uses custom amounts', () => {
    const expenses = [{
      paidBy: 'alice', amount: '100', splitType: 'unequal',
      participants: ['alice', 'bob', 'carol'],
      splits: { alice: 50, bob: 30, carol: 20 }
    }];
    const b = calculateBalances(roommates, expenses, []);
    expect(b.alice).toBeCloseTo(50);  // paid 100, owes 50 → +50
    expect(b.bob).toBeCloseTo(-30);
    expect(b.carol).toBeCloseTo(-20);
  });

  it('payments reduce the balance', () => {
    const expenses = [{
      paidBy: 'alice', amount: '90', splitType: 'equal',
      participants: ['alice', 'bob', 'carol']
    }];
    const payments = [{ from: 'bob', to: 'alice', amount: '30' }];
    const b = calculateBalances(roommates, expenses, payments);
    expect(b.alice).toBeCloseTo(30);
    expect(b.bob).toBeCloseTo(0);
    expect(b.carol).toBeCloseTo(-30);
  });

  it('ignores participants not in roommates list', () => {
    const expenses = [{
      paidBy: 'alice', amount: '60', splitType: 'equal',
      participants: ['alice', 'unknown']
    }];
    const b = calculateBalances(roommates, expenses, []);
    expect(b.alice).toBeDefined();
    expect(b.bob).toBeDefined();
  });
});

describe('simplifyDebts', () => {
  it('returns empty array when everyone is settled', () => {
    const b = { alice: 0, bob: 0, carol: 0 };
    expect(simplifyDebts(b, roommates)).toEqual([]);
  });

  it('single debt produces one transaction', () => {
    const b = { alice: 30, bob: -30, carol: 0 };
    const txns = simplifyDebts(b, roommates);
    expect(txns).toHaveLength(1);
    expect(txns[0].from).toBe('bob');
    expect(txns[0].to).toBe('alice');
    expect(txns[0].amount).toBeCloseTo(30);
  });

  it('minimises number of transactions', () => {
    // alice +60, bob -30, carol -30 → 2 transactions
    const b = { alice: 60, bob: -30, carol: -30 };
    const txns = simplifyDebts(b, roommates);
    expect(txns.length).toBeLessThanOrEqual(2);
  });
});

describe('getTotalSpent', () => {
  it('sums all expense amounts', () => {
    const expenses = [{ amount: '50' }, { amount: '25.5' }, { amount: '10' }];
    expect(getTotalSpent(expenses)).toBeCloseTo(85.5);
  });

  it('returns 0 for empty list', () => {
    expect(getTotalSpent([])).toBe(0);
  });
});
