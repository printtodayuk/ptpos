
'use server';

import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/firebase';
import type { Notice } from '@/lib/types';

export async function getCurrentNotice(): Promise<Notice | null> {
  try {
    const q = query(collection(db, 'notices'), orderBy('updatedAt', 'desc'), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    
    const data = snapshot.docs[0].data();
    return {
      id: snapshot.docs[0].id,
      content: data.content,
      updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
      updatedBy: data.updatedBy,
    } as Notice;
  } catch (error) {
    console.error('Error fetching notice:', error);
    return null;
  }
}

export async function saveNotice(content: string, operator: string) {
  try {
    const noticeRef = doc(db, 'notices', 'current');
    await setDoc(noticeRef, {
      content,
      updatedAt: Timestamp.now(),
      updatedBy: operator,
    });
    revalidatePath('/dashboard');
    revalidatePath('/admin');
    return { success: true, message: 'Notice updated successfully.' };
  } catch (error) {
    console.error('Error saving notice:', error);
    return { success: false, message: 'Failed to update notice.' };
  }
}
