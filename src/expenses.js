import {
  doc, collection, addDoc, updateDoc, deleteDoc,
  onSnapshot, serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase.js';

const MAX_RECEIPT_BYTES = 200 * 1024; // 200 KB

/** Validate and read receipt file as Base64 */
export function readReceiptAsBase64(file) {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_RECEIPT_BYTES) {
      reject(new Error(`Receipt image too large (${(file.size/1024).toFixed(1)} KB). Max is 200 KB.`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result); // data:image/...;base64,...
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

/** Add a new expense */
export async function addExpense(houseId, data, creatorUid) {
  const ref = collection(db, 'houses', houseId, 'expenses');
  const docRef = await addDoc(ref, {
    ...data,
    creatorUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
}

/** Update an existing expense (only creator) */
export async function updateExpense(houseId, expenseId, data) {
  await updateDoc(doc(db, 'houses', houseId, 'expenses', expenseId), {
    ...data,
    updatedAt: serverTimestamp()
  });
}

/** Delete an expense (only creator) */
export async function deleteExpense(houseId, expenseId) {
  await deleteDoc(doc(db, 'houses', houseId, 'expenses', expenseId));
}

/** Real-time listener for all expenses */
export function listenExpenses(houseId, callback) {
  const col = collection(db, 'houses', houseId, 'expenses');
  return onSnapshot(col, (snap) => {
    const expenses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Sort by date descending
    expenses.sort((a, b) => {
      const da = a.date || '';
      const db2 = b.date || '';
      return da > db2 ? -1 : 1;
    });
    callback(expenses, snap.docChanges());
  });
}

export const CATEGORY_EMOJI = {
  groceries: '🛒',
  utilities: '⚡',
  rent: '🏠',
  entertainment: '🎉',
  transport: '🚗',
  food: '🍕',
  other: '📦'
};

export const CATEGORY_COLORS = {
  groceries: '#4db6ac',
  utilities: '#ffb74d',
  rent: '#6c63ff',
  entertainment: '#f06292',
  transport: '#64b5f6',
  food: '#ff8a65',
  other: '#aed581'
};
