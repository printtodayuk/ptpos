import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';

// Helper to initialize Firebase App in a singleton pattern
function initializeAppSingleton() {
    if (!getApps().length) {
        return initializeApp(firebaseConfig);
    }
    return getApp();
}

const app = initializeAppSingleton();
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
