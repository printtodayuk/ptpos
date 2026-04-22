'use server';

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/firebase';
import { AppFeatures } from '@/lib/types';

const defaultFeatures: AppFeatures = {
  createJobSheet: true,
  transactions: true,
  createQuotation: true,
  createInvoice: true,
  manageContacts: true,
  manageTasks: true,
  attendance: true,
  reports: true,
};

export async function getAppFeatures(): Promise<AppFeatures> {
  try {
    const docRef = doc(db, 'settings', 'features');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { ...defaultFeatures, ...docSnap.data() } as AppFeatures;
    } else {
      // If no document exists, create it with default values
      await setDoc(docRef, defaultFeatures);
      return defaultFeatures;
    }
  } catch (error) {
    console.error('Error fetching app features:', error);
    return defaultFeatures;
  }
}

export async function updateAppFeatures(features: Partial<AppFeatures>) {
  try {
    const docRef = doc(db, 'settings', 'features');
    await setDoc(docRef, features, { merge: true });
    
    // Revalidate paths that might be affected
    revalidatePath('/', 'layout');
    
    return { success: true, message: 'Features updated successfully.' };
  } catch (error) {
    console.error('Error updating app features:', error);
    return { success: false, message: 'Failed to update features.' };
  }
}
