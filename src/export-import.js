import {
  collection, getDocs, addDoc, deleteDoc,
  writeBatch, doc, serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase.js';
import { showToast } from './toast.js';

/** Export all house data as a downloadable JSON file */
export async function exportHouseData(houseId, houseName) {
  try {
    const [roommatesSnap, expensesSnap, paymentsSnap] = await Promise.all([
      getDocs(collection(db, 'houses', houseId, 'roommates')),
      getDocs(collection(db, 'houses', houseId, 'expenses')),
      getDocs(collection(db, 'houses', houseId, 'payments'))
    ]);

    const data = {
      exportedAt: new Date().toISOString(),
      houseId,
      houseName,
      roommates: roommatesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      expenses: expensesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      payments: paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roomsync-${houseName.replace(/\s+/g, '-')}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Data exported successfully!', 'success');
  } catch (err) {
    showToast(`Export failed: ${err.message}`, 'error');
  }
}

/** Import house data from a JSON file (overwrites current data) */
export async function importHouseData(houseId, jsonData) {
  try {
    const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
    const BATCH_LIMIT = 400; // Firestore batch limit is 500

    // Delete existing data
    for (const sub of ['roommates', 'expenses', 'payments']) {
      const snap = await getDocs(collection(db, 'houses', houseId, sub));
      let batch = writeBatch(db);
      let count = 0;
      for (const d of snap.docs) {
        batch.delete(d.ref);
        count++;
        if (count >= BATCH_LIMIT) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
      if (count > 0) await batch.commit();
    }

    // Import new data
    for (const sub of ['roommates', 'expenses', 'payments']) {
      const items = data[sub] || [];
      let batch = writeBatch(db);
      let count = 0;
      for (const item of items) {
        const { id, createdAt, updatedAt, joinedAt, ...rest } = item;
        const ref = id
          ? doc(db, 'houses', houseId, sub, id)
          : doc(collection(db, 'houses', houseId, sub));
        batch.set(ref, { ...rest, importedAt: serverTimestamp() });
        count++;
        if (count >= BATCH_LIMIT) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
      if (count > 0) await batch.commit();
    }

    showToast('Data imported successfully!', 'success');
  } catch (err) {
    showToast(`Import failed: ${err.message}`, 'error');
    throw err;
  }
}
