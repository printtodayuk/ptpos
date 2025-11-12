import { initializeApp, getApps, getApp, deleteApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';
import { getAuth as getAdminAuth, App as AdminApp, initializeApp as initializeAdminApp, getApps as getAdminApps } from 'firebase-admin/app';
import { credential } from 'firebase-admin';
import { initializeAdminAppSingleton } from './firebase-admin';


async function getAuthenticatedAppForUser(userId: string) {
    const adminApp = initializeAdminAppSingleton();
    const adminAuth = getAdminAuth(adminApp);
    const customToken = await adminAuth.createCustomToken(userId);
    
    const userAppName = `user-app-${userId}`;
    let userApp = getApps().find(app => app.name === userAppName);

    if (userApp) {
        const auth = getAuth(userApp);
        if (auth.currentUser?.uid === userId) {
            return {
                app: userApp,
                firestore: getFirestore(userApp),
                auth: auth
            };
        }
        await deleteApp(userApp);
    }
    
    userApp = initializeApp(firebaseConfig, userAppName);
    const auth = getAuth(userApp);
    await auth.signInWithCustomToken(customToken);

    return {
        app: userApp,
        firestore: getFirestore(userApp),
        auth: auth
    };
}


export { getAuthenticatedAppForUser };
