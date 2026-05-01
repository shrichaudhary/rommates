import {
  doc, collection, addDoc, updateDoc, deleteDoc,
  onSnapshot, serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase.js';

export async function addPayment(houseId, data, creatorUid) {
  const ref = collection(db, 'houses', houseId, 'payments');
  const docRef = await addDoc(ref, {
    ...data,
    creatorUid,
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

export async function updatePayment(houseId, paymentId, data) {
  await updateDoc(doc(db, 'houses', houseId, 'payments', paymentId), {
    ...data,
    updatedAt: serverTimestamp()
  });
}

export async function deletePayment(houseId, paymentId) {
  await deleteDoc(doc(db, 'houses', houseId, 'payments', paymentId));
}

export function listenPayments(houseId, callback) {
  const col = collection(db, 'houses', houseId, 'payments');
  return onSnapshot(col, (snap) => {
    const payments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    payments.sort((a, b) => (a.date > b.date ? -1 : 1));
    callback(payments, snap.docChanges());
  });
}
