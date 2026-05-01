// ─── REPLACE THIS BLOCK WITH YOUR FIREBASE PROJECT CONFIG ───────────────────
// Go to: Firebase Console → Your Project → Project Settings → Your apps → Config
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAYtpl1BHFbtwqQ2GQr-aDsS2mAUPKBlN0",
  authDomain: "studyhub-bd4f0.firebaseapp.com",
  databaseURL: "https://studyhub-bd4f0-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "studyhub-bd4f0",
  storageBucket: "studyhub-bd4f0.firebasestorage.app",
  messagingSenderId: "813436388600",
  appId: "1:813436388600:web:be5a288d470a93401a670d",
  measurementId: "G-C4LRNZKPR1"
};
// ─────────────────────────────────────────────────────────────────────────────

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// initializeFirestore with persistentLocalCache enables offline support
// without the deprecated enableIndexedDbPersistence() call.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ cacheSizeBytes: CACHE_SIZE_UNLIMITED })
});

export default app;
