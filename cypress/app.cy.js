// Cypress E2E test suite for RoomSync
// Run: npx cypress open  (then open app.cy.js in the Cypress UI)
// Requires: npm run dev running at localhost:5173
// Requires: valid Firebase config in src/firebase.js

const BASE_URL = 'http://localhost:5173';
const TEST_EMAIL = `test_${Date.now()}@roomsync.test`;
const TEST_PASS = 'TestPass123!';
const TEST_NAME = 'Test User';
const HOUSE_NAME = 'Cypress House';

describe('RoomSync E2E', () => {
  // ── Sign Up ──────────────────────────────────────────────────────────────
  it('signs up a new user', () => {
    cy.visit(BASE_URL);
    cy.get('#loading-screen', { timeout: 8000 }).should('not.be.visible');
    cy.get('#tab-signup').click();
    cy.get('#signup-name').type(TEST_NAME);
    cy.get('#signup-email').type(TEST_EMAIL);
    cy.get('#signup-password').type(TEST_PASS);
    cy.get('#btn-signup').click();
    cy.get('#app-screen', { timeout: 10000 }).should('be.visible');
  });

  // ── Create House ─────────────────────────────────────────────────────────
  it('creates a house', () => {
    cy.get('#view-house-setup', { timeout: 5000 }).should('be.visible');
    cy.get('#house-name').type(HOUSE_NAME);
    cy.get('#btn-create-house').click();
    cy.get('#view-dashboard', { timeout: 10000 }).should('not.have.class', 'hidden');
    cy.get('#stat-total-value').should('exist');
  });

  // ── Invite Flow ───────────────────────────────────────────────────────────
  it('generates an invite link', () => {
    cy.get('#btn-invite').click();
    cy.get('#modal-invite').should('not.have.class', 'hidden');
    cy.get('#invite-link-input').invoke('val').should('include', '?join=');
    cy.get('#join-code-text').invoke('text').should('match', /^[A-Z0-9]{6}$/);
    cy.get('#btn-copy-link').click();
    // Modal close
    cy.get('#modal-invite .btn-close').click();
    cy.get('#modal-invite').should('have.class', 'hidden');
  });

  // ── Add Expense ───────────────────────────────────────────────────────────
  it('adds an expense', () => {
    cy.get('[data-view="expenses"]').click();
    cy.get('#btn-add-expense').click();
    cy.get('#modal-expense').should('not.have.class', 'hidden');
    cy.get('#expense-desc').type('Monthly Groceries');
    cy.get('#expense-amount').type('600');
    cy.get('#expense-category').select('groceries');
    // All participants pre-checked by default
    cy.get('#btn-save-expense').click();
    cy.get('#modal-expense', { timeout: 5000 }).should('have.class', 'hidden');
    cy.get('#expenses-list .expense-card').should('exist');
    cy.get('#expenses-list .card-title').first().should('contain', 'Monthly Groceries');
  });

  // ── Edit/Delete restrictions ──────────────────────────────────────────────
  it('shows edit/delete buttons only for creator', () => {
    // Current user created the expense, so buttons should be visible
    cy.get('#expenses-list .edit-expense-btn').first().should('exist');
    cy.get('#expenses-list .delete-expense-btn').first().should('exist');
  });

  it('edits an expense', () => {
    cy.get('#expenses-list .edit-expense-btn').first().click();
    cy.get('#modal-expense').should('not.have.class', 'hidden');
    cy.get('#expense-desc').clear().type('Updated Groceries');
    cy.get('#btn-save-expense').click();
    cy.get('#modal-expense', { timeout: 5000 }).should('have.class', 'hidden');
    cy.get('#expenses-list .card-title').first().should('contain', 'Updated Groceries');
  });

  // ── Dashboard Balances ────────────────────────────────────────────────────
  it('shows balance stats on dashboard', () => {
    cy.get('[data-view="dashboard"]').click();
    cy.get('#stat-total-value').should('not.contain', '₹0.00');
    cy.get('#balances-list').should('exist');
  });

  // ── Record Payment ────────────────────────────────────────────────────────
  it('records a payment', () => {
    cy.get('[data-view="payments"]').click();
    cy.get('#btn-add-payment').click();
    cy.get('#modal-payment').should('not.have.class', 'hidden');
    cy.get('#payment-amount').type('200');
    cy.get('#payment-note').type('Test settlement');
    cy.get('#btn-save-payment').click();
    cy.get('#modal-payment', { timeout: 5000 }).should('have.class', 'hidden');
    cy.get('#payments-list .payment-card').should('exist');
  });

  // ── Export / Import ───────────────────────────────────────────────────────
  it('exports data as JSON', () => {
    cy.get('#btn-export').click();
    // File download triggered — just verify no error toast appeared
    cy.get('.toast-error').should('not.exist');
  });

  // ── Delete Expense ────────────────────────────────────────────────────────
  it('deletes an expense', () => {
    cy.get('[data-view="expenses"]').click();
    cy.get('#expenses-list .delete-expense-btn').first().click();
    // Confirm dialog
    cy.get('#modal-confirm').should('not.have.class', 'hidden');
    cy.get('#btn-confirm-ok').click();
    cy.get('.toast-success', { timeout: 5000 }).should('exist');
  });

  // ── Sign Out ──────────────────────────────────────────────────────────────
  it('signs out', () => {
    cy.get('#btn-signout').click();
    cy.get('#auth-screen', { timeout: 5000 }).should('not.have.class', 'hidden');
  });
});
