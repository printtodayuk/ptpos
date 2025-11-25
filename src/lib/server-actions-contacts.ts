'use server';

import {
  addDoc,
  collection,
  serverTimestamp,
  getDocs,
  orderBy,
  query,
} from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Contact } from '@/lib/types';
import { ContactSchema } from '@/lib/types';
import { db } from '@/lib/firebase';

const CreateContactSchema = ContactSchema.omit({
  id: true,
  createdAt: true,
});

export async function addContact(data: z.infer<typeof CreateContactSchema>) {
  const validatedData = CreateContactSchema.safeParse(data);
  if (!validatedData.success) {
    return {
      success: false,
      message: 'Validation failed.',
      errors: validatedData.error.flatten().fieldErrors,
    };
  }

  try {
    await addDoc(collection(db, 'contacts'), {
      ...validatedData.data,
      createdAt: serverTimestamp(),
    });

    revalidatePath('/contact-list');
    return { success: true, message: 'Contact saved successfully.' };
  } catch (error) {
    console.error('Error adding contact:', error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred.',
    };
  }
}

export async function getContacts(): Promise<Contact[]> {
  try {
    const q = query(collection(db, 'contacts'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        createdAt: data.createdAt?.toDate(),
      } as Contact;
    });
  } catch (e) {
    console.error('Error fetching contacts:', e);
    return [];
  }
}
