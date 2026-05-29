'use server';

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/firebase';

const DEFAULT_OPERATOR_DATA = [
  { id: 'PTMGH', pin: '7044' },
  { id: 'PTM', pin: '1414' },
  { id: 'PTRK', pin: '1593' },
  { id: 'PTASAD', pin: '2563' },
  { id: 'PTASH', pin: '6969' },
  { id: 'PTITAdmin', pin: '5206' }
];

export async function getOperators(): Promise<{ id: string; pin: string }[]> {
  try {
    const colRef = collection(db, 'operators');
    const snapshot = await getDocs(colRef);
    
    if (snapshot.empty) {
      // Auto-populate with default data if empty to prevent empty system on first load
      console.log('Operators collection is empty. Populating with defaults...');
      for (const op of DEFAULT_OPERATOR_DATA) {
        await setDoc(doc(db, 'operators', op.id), { pin: op.pin });
      }
      return DEFAULT_OPERATOR_DATA;
    }

    return snapshot.docs.map(doc => ({
      id: doc.id,
      pin: doc.data().pin || '',
    }));
  } catch (error) {
    console.error('Error fetching operators:', error);
    return DEFAULT_OPERATOR_DATA; // Fallback to defaults on error
  }
}

export async function isValidOperator(name: string): Promise<boolean> {
  try {
    const docSnap = await getDoc(doc(db, 'operators', name));
    return docSnap.exists();
  } catch (error) {
    console.error('Error checking operator existence:', error);
    return DEFAULT_OPERATOR_DATA.some(op => op.id === name);
  }
}

export async function saveOperator(id: string, pin: string) {
  try {
    if (!id || id.trim().length === 0) {
      return { success: false, message: 'Operator ID is required.' };
    }
    if (!pin || pin.trim().length < 4) {
      return { success: false, message: 'PIN code must be at least 4 digits.' };
    }
    
    const formattedId = id.trim().toUpperCase();
    await setDoc(doc(db, 'operators', formattedId), { pin: pin.trim() });
    
    revalidatePath('/admin');
    revalidatePath('/dashboard');
    return { success: true, message: `Operator '${formattedId}' saved successfully.` };
  } catch (error) {
    console.error('Error saving operator:', error);
    return { success: false, message: 'Failed to save operator.' };
  }
}

export async function deleteOperator(id: string) {
  try {
    if (id === 'PTITAdmin') {
      return { success: false, message: 'Cannot delete the master admin user (PTITAdmin).' };
    }
    
    await deleteDoc(doc(db, 'operators', id));
    
    revalidatePath('/admin');
    revalidatePath('/dashboard');
    return { success: true, message: `Operator '${id}' deleted successfully.` };
  } catch (error) {
    console.error('Error deleting operator:', error);
    return { success: false, message: 'Failed to delete operator.' };
  }
}
