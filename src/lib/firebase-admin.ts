import "server-only";
import { initializeApp, getApps, App, credential } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

// This is a server-only module that initializes the Firebase Admin SDK.

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
    // In a development or non-Google environment, you might use a service account key
    // For App Hosting, it will use the application default credentials
    app = initializeApp();
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
