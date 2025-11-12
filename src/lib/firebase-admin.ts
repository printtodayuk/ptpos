import "server-only";
import { initializeApp, getApps, App, credential } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

let app: App | null = null;
let db: Firestore | null = null;

function getFirebaseAdminApp(): App {
  if (app) {
    return app;
  }

  const apps = getApps();
  if (apps.length > 0) {
    app = apps[0];
  } else {
    // At the top of your file
    if (process.env.VERCEL) {
        // In Vercel, the GOOGLE_APPLICATION_CREDENTIALS environment variable is automatically set.
        app = initializeApp({
            credential: credential.applicationDefault(),
        });
    } else if (process.env.NODE_ENV === 'development' && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        // In local development, you might use a service account key file
        app = initializeApp({
            credential: credential.applicationDefault(),
        });
    }
    else {
        // For App Hosting or other Google Cloud environments, it will use the application default credentials
        app = initializeApp();
    }
  }

  return app;
}


export function getDb(): Firestore {
    if (db) {
        return db;
    }
    const adminApp = getFirebaseAdminApp();
    db = getFirestore(adminApp);
    return db;
}
