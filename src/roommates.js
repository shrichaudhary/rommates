import {
  doc, collection, setDoc, deleteDoc, onSnapshot, serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase.js';

/** Subscribe to real-time roommate list */
export function listenRoommates(houseId, callback) {
  const col = collection(db, 'houses', houseId, 'roommates');
  return onSnapshot(col, (snap) => {
    const members = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(members);
  });
}

/** Manually add a roommate (non-auth member, placeholder) */
export async function addRoommate(houseId, { name, email }) {
  const ref = doc(collection(db, 'houses', houseId, 'roommates'));
  await setDoc(ref, {
    name: name.trim(),
    email: email ? email.trim() : '',
    uid: null,
    isOwner: false,
    joinedAt: serverTimestamp()
  });
  return ref.id;
}

/** Remove a roommate document */
export async function removeRoommate(houseId, roommateId) {
  await deleteDoc(doc(db, 'houses', houseId, 'roommates', roommateId));
}

/** Get a colour for a member's avatar based on their name */
export function getAvatarColor(name) {
  const colors = [
    '#6c63ff','#f06292','#4db6ac','#ff8a65',
    '#aed581','#ffb74d','#64b5f6','#ba68c8'
  ];
  let hash = 0;
  for (const ch of (name || '?')) hash = ch.charCodeAt(0) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

/** Build avatar HTML for a member */
export function memberAvatar(name, size = 40) {
  const initials = (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const color = getAvatarColor(name);
  return `<div class="avatar" style="width:${size}px;height:${size}px;background:${color};font-size:${Math.floor(size*0.38)}px;" aria-label="${name} avatar">${initials}</div>`;
}
