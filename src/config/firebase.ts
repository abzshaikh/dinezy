import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

/**
 * Firebase project config. In the emulator-first dev setup these values are
 * placeholders — the Auth/Firestore emulators don't validate them against a
 * real project. When you're ready to point this at a real Firebase project,
 * replace the values below (or better, wire them from environment
 * variables) with the real web app config from the Firebase console, and
 * set VITE_USE_FIREBASE_EMULATOR=false.
 *
 * NOTE: Firebase Storage is deliberately NOT initialized here. Cloud Storage
 * for Firebase now requires the project to be on the Blaze (pay-as-you-go)
 * plan — Spark (free) projects get rejected even for tiny usage (a Google
 * policy change from Sept 2024). This project is on Spark, so images
 * (menu items, restaurant logos) go through Cloudinary instead — see
 * src/services/cloudinaryService.ts. If you later upgrade to Blaze and want
 * Firebase Storage instead, re-add `getStorage`/`connectStorageEmulator`
 * here plus a storage.rules file and the "storage" section in firebase.json.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'demo-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'demo-restaurant-rms.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'demo-restaurant-rms',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? 'demo-restaurant-rms.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '000000000000',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '1:000000000000:web:0000000000000000000000',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR !== 'false';

if (useEmulator) {
  // Guard against double-connecting during Vite HMR.
  const g = globalThis as unknown as { __RMS_EMULATOR_CONNECTED__?: boolean };
  if (!g.__RMS_EMULATOR_CONNECTED__) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    g.__RMS_EMULATOR_CONNECTED__ = true;
    // eslint-disable-next-line no-console
    console.info('[firebase] Connected to local emulators (Auth 9099, Firestore 8080)');
  }
}
