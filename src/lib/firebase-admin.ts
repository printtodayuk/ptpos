import { App as AdminApp, initializeApp as initializeAdminApp, getApps as getAdminApps } from 'firebase-admin/app';
import { credential } from 'firebase-admin';

const ADMIN_APP_NAME = 'firebase-frameworks-admin';

export function initializeAdminAppSingleton(): AdminApp {
    const adminApps = getAdminApps();
    const existingApp = adminApps.find(app => app.name === ADMIN_APP_NAME);
    if (existingApp) {
        return existingApp;
    }

    return initializeAdminApp({
        credential: credential.applicationDefault(),
    }, ADMIN_APP_NAME);
}
