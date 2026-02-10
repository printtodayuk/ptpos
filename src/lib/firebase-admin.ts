import 'server-only';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

// Ensure only one app instance is initialized
const app: App = getApps().length
    ? getApps()[0]
    : initializeApp();

const db: Firestore = getFirestore(app);

export { db };
