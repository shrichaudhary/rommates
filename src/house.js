import {
  doc, collection, addDoc, setDoc, getDoc, getDocs,
  query, where, onSnapshot, serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase.js';
import { updateUserHouse } from './auth.js';

/** Generate a random 6-character alphanumeric join code */
export function generateJoinCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** Create a new house document */
export async function createHouse(name, user) {
  const joinCode = generateJoinCode();
  const houseRef = doc(collection(db, 'houses'));
  const houseData = {
    name,
    joinCode,
    creatorUid: user.uid,
    createdAt: serverTimestamp(),
    memberUids: [user.uid]
  };
  await setDoc(houseRef, houseData);

  // Add creator as a roommate member
  await setDoc(doc(db, 'houses', houseRef.id, 'roommates', user.uid), {
    name: user.displayName || 'Owner',
    email: user.email || '',
    uid: user.uid,
    isOwner: true,
    joinedAt: serverTimestamp()
  });

  await updateUserHouse(user.uid, houseRef.id);
  return { id: houseRef.id, ...houseData };
}

/** Look up a house by its join code */
export async function findHouseByCode(code) {
  const q = query(collection(db, 'houses'), where('joinCode', '==', code.toUpperCase()));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { id: docSnap.id, ...docSnap.data() };
}

/** Add a user to a house as a roommate */
export async function joinHouseByCode(code, user) {
  const house = await findHouseByCode(code);
  if (!house) throw new Error('Invalid join code. House not found.');

  const houseRef = doc(db, 'houses', house.id);
  const houseSnap = await getDoc(houseRef);
  const houseData = houseSnap.data();
  const memberUids = houseData.memberUids || [];

  if (!memberUids.includes(user.uid)) {
    await setDoc(houseRef, {
      memberUids: [...memberUids, user.uid]
    }, { merge: true });

    await setDoc(doc(db, 'houses', house.id, 'roommates', user.uid), {
      name: user.displayName || user.email || 'New Member',
      email: user.email || '',
      uid: user.uid,
      isOwner: false,
      joinedAt: serverTimestamp()
    });
  }

  await updateUserHouse(user.uid, house.id);
  return house;
}

/** Get a house document once */
export async function getHouseDoc(houseId) {
  const snap = await getDoc(doc(db, 'houses', houseId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Subscribe to real-time house document updates */
export function listenHouse(houseId, callback) {
  return onSnapshot(doc(db, 'houses', houseId), (snap) => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() });
  });
}

/** Read join code from the URL query string */
export function detectJoinCodeFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('join') || null;
}

/** Build invite URL for a given house */
export function buildInviteUrl(joinCode) {
  const base = window.location.origin + window.location.pathname;
  return `${base}?join=${joinCode}`;
}
