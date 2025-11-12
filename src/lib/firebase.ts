import { initializeApp, getApps, getApp, deleteApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';
import { cookies } from 'next/headers';
import { getAuth as getAdminAuth, App as AdminApp, initializeApp as initializeAdminApp, getApps as getAdminApps, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { credential } from 'firebase-admin';

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


// --- Admin SDK ---
const ADMIN_APP_NAME = 'firebase-frameworks';

function initializeAdminAppSingleton(): AdminApp {
    const adminApps = getAdminApps();
    const existingApp = adminApps.find(app => app.name === ADMIN_APP_NAME);
    if (existingApp) {
        return existingApp;
    }

    // When deployed to App Hosting, the service account credentials will be automatically provided.
    const a = initializeAdminApp({
        credential: credential.applicationDefault(),
    }, ADMIN_APP_NAME);

    return a;
}

async function getAuthenticatedAppForUser(userId: string) {
    const adminApp = initializeAdminAppSingleton();
    const adminAuth = getAdminAuth(adminApp);
    const customToken = await adminAuth.createCustomToken(userId);
    
    // Create a temporary app for the user
    const userAppName = `user-app-${userId}`;
    let userApp = getApps().find(app => app.name === userAppName);

    if (userApp) {
        await deleteApp(userApp);
    }
    
    userApp = initializeApp(firebaseConfig, userAppName);
    const auth = getAuth(userApp);
    await getAuth(userApp).signInWithCustomToken(customToken);

    return {
        app: userApp,
        firestore: getFirestore(userApp),
        auth: auth
    };
}


export { app, db, auth, getAuthenticatedAppForUser };
