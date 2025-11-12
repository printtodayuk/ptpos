import { initializeApp, getApps, getApp, deleteApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { initializeAdminAppSingleton } from './firebase-admin';
import { headers } from 'next/headers';


async function getAuthenticatedAppForUser() {
    const headersList = headers();
    const session = headersList.get('x-session-cookie');

    if (!session) {
        throw new Error('No session cookie provided. User is not authenticated.');
    }

    const adminApp = initializeAdminAppSingleton();
    const adminAuth = getAdminAuth(adminApp);
    const decodedToken = await adminAuth.verifySessionCookie(session, true);
    const customToken = await adminAuth.createCustomToken(decodedToken.uid);
    
    const userAppName = `user-app-${decodedToken.uid}`;
    let userApp = getApps().find(app => app.name === userAppName);

    if (userApp) {
        const auth = getAuth(userApp);
        if (auth.currentUser?.uid === decodedToken.uid) {
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
    await signInWithCustomToken(auth, customToken);

    return {
        app: userApp,
        firestore: getFirestore(userApp),
        auth: auth
    };
}


export { getAuthenticatedAppForUser };
