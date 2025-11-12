import "server-only";
import { initializeApp, getApps, App } from "firebase-admin/app";
import { firebaseConfig } from "@/firebase/config";

// This is a server-only module that initializes the Firebase Admin SDK.

// Cache the initialized app instance.
let app: App | null = null;

export function getFirebaseAdminApp(): App {
  if (app) {
    return app;
  }

  // Check if an app is already initialized. If not, initialize one.
  const apps = getApps();
  if (apps.length > 0) {
    app = apps[0];
  } else {
    app = initializeApp({
        projectId: firebaseConfig.projectId,
    });
  }

  return app;
}
